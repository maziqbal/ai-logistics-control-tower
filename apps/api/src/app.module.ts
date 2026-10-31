import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { DatabaseModule } from './db/database.module';
import { DeliveryDaysModule } from './delivery-days/delivery-days.module';

@Module({
  imports: [DatabaseModule, DeliveryDaysModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
