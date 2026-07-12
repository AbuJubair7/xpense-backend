import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    return {
      status: 'ok',
      uptime: `${hours} hours ${minutes} minutes and ${seconds} seconds`,
      timestamp: new Date().toISOString(),
    };
  }
}
