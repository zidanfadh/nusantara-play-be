import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API metadata', () => {
      expect(appController.getHello()).toEqual({
        name: 'Nusantara Play API',
        description: 'Platform Digital Arsip Permainan Rakyat Indonesia',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth',
          users: '/api/users',
          daerah: '/api/daerah',
          upload: '/api/upload',
          audit: '/api/audit',
        },
        documentation: 'See README.md for full API documentation',
        status: 'Foundation MVP Complete - Ready for Phase 2',
      });
    });
  });
});
