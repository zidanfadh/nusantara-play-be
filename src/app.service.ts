import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
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
    };
  }
}
