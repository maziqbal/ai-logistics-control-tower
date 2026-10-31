import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { DatabaseModule } from './db/database.module';
import { DeliveryDaysModule } from './delivery-days/delivery-days.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [DatabaseModule, DeliveryDaysModule, DriversModule, VehiclesModule],
  controllers: [AppController],
})
export class AppModule {}
