import { Controller, Get } from '@nestjs/common';

@Controller('api/v1')
export class AppController {
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
