import { Module } from '@nestjs/common';

import { DeliveryDaysController } from './delivery-days.controller';
import { DeliveryDaysService } from './delivery-days.service';

@Module({
  controllers: [DeliveryDaysController],
  providers: [DeliveryDaysService],
})
export class DeliveryDaysModule {}
