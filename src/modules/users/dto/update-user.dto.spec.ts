/**
 * Phase 06, P4: avatar_url accepts only an https URL of at most 500
 * characters, or null / empty string to clear it (stored as null).
 * Runs the same class-transformer + class-validator steps as the global
 * ValidationPipe (transform: true, whitelist, forbidNonWhitelisted).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';
import { CreateUserDto } from './create-user.dto';

async function check(avatar_url: unknown) {
  const dto = plainToInstance(UpdateUserDto, { avatar_url });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('UpdateUserDto.avatar_url (P4)', () => {
  it('accepts an https URL', async () => {
    const { errors, dto } = await check('https://cdn.example.test/a.png');
    expect(errors).toHaveLength(0);
    expect(dto.avatar_url).toBe('https://cdn.example.test/a.png');
  });

  it('accepts a Google profile photo URL', async () => {
    const url = 'https://lh3.googleusercontent.com/a/ACg8ocJ-abc=s96-c';
    expect((await check(url)).errors).toHaveLength(0);
  });

  it.each([
    ['http URL', 'http://cdn.example.test/a.png'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:image/png;base64,AAAA'],
    ['protocol-relative URL', '//cdn.example.test/a.png'],
    ['no protocol', 'cdn.example.test/a.png'],
    ['not a URL', 'not a url'],
    ['a number', 42],
  ])('rejects %s', async (_label, value) => {
    const { errors } = await check(value);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('avatar_url');
  });

  it('rejects a URL longer than 500 characters', async () => {
    const url = `https://cdn.example.test/${'a'.repeat(500)}.png`;
    expect(url.length).toBeGreaterThan(500);
    const { errors } = await check(url);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('accepts a URL of exactly 500 characters', async () => {
    const prefix = 'https://cdn.example.test/';
    const url = prefix + 'a'.repeat(500 - prefix.length);
    expect(url).toHaveLength(500);
    expect((await check(url)).errors).toHaveLength(0);
  });

  it('accepts null to clear the avatar', async () => {
    const { errors, dto } = await check(null);
    expect(errors).toHaveLength(0);
    expect(dto.avatar_url).toBeNull();
  });

  it('turns an empty or blank string into null (clears the avatar)', async () => {
    for (const value of ['', '   ']) {
      const { errors, dto } = await check(value);
      expect(errors).toHaveLength(0);
      expect(dto.avatar_url).toBeNull();
    }
  });

  it('leaves avatar_url out when it is not sent', async () => {
    const dto = plainToInstance(UpdateUserDto, { full_name: 'X' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.avatar_url).toBeUndefined();
  });
});

describe('CreateUserDto.avatar_url (P4)', () => {
  const base = {
    supabase_user_id: '00000000-0000-4000-8000-000000000007',
    email: 'x@example.test',
    full_name: 'X',
  };

  it('accepts https and rejects javascript:', async () => {
    const ok = plainToInstance(CreateUserDto, {
      ...base,
      avatar_url: 'https://cdn.example.test/a.png',
    });
    const bad = plainToInstance(CreateUserDto, {
      ...base,
      avatar_url: 'javascript:alert(1)',
    });
    expect(await validate(ok)).toHaveLength(0);
    expect((await validate(bad)).map((e) => e.property)).toEqual([
      'avatar_url',
    ]);
  });
});
