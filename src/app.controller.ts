import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class AppController {
  @Get('/health')
  @SkipThrottle()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
