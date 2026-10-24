import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { DatabaseModule } from './db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
