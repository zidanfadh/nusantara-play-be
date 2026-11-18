/**
 * Phase 06, P2: the exception filter must not log personal data. A
 * TypeORM QueryFailedError carries the query parameters and the driver's
 * `detail` (e.g. "Key (email)=(x@y) already exists"); only the error name,
 * message and stack may be logged.
 */
import {
  ArgumentsHost,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpExceptionFilter } from './http-exception.filter';

function hostFor(url = '/api/users') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter logging (P2)', () => {
  let errorSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('logs a database error without its parameters or driver detail', () => {
    const driverError = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "UQ_users_email"',
      ),
      { detail: 'Key (email)=(someone@example.test) already exists.' },
    );
    const exception = new QueryFailedError(
      'INSERT INTO "users"("email", "phone") VALUES ($1, $2)',
      ['someone@example.test', '+62 812 3456 7890'],
      driverError,
    );
    const { host, status, json } = hostFor();

    new HttpExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('QueryFailedError');
    expect(logged).not.toContain('someone@example.test');
    expect(logged).not.toContain('+62 812 3456 7890');
  });

  it('does not log expected HTTP errors', () => {
    const { host, status } = hostFor();

    new HttpExceptionFilter().catch(new NotFoundException('nope'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs a non-Error throw without serializing it', () => {
    const { host } = hostFor();

    new HttpExceptionFilter().catch({ email: 'someone@example.test' }, host);

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain('someone@example.test');
  });
});
