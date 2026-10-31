import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';

import { DATABASE } from '../db/database.types';
import type { AppDatabase } from '../db/database.types';
import { deliveryDays } from '../db/schema';
import type { CreateDeliveryDayDto } from './dto/create-delivery-day.dto';

@Injectable()
export class DeliveryDaysService {
  constructor(
    @Inject(DATABASE)
    private readonly db: AppDatabase,
  ) {}

  async create(dto: CreateDeliveryDayDto) {
    try {
      const [deliveryDay] = await this.db
        .insert(deliveryDays)
        .values({
          serviceDate: dto.serviceDate,
          operatingArea: dto.operatingArea,
        })
        .returning();

      return deliveryDay;
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A delivery day already exists for this date and operating area',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.db
      .select()
      .from(deliveryDays)
      .orderBy(desc(deliveryDays.serviceDate));
  }

  async findOne(id: string) {
    const [deliveryDay] = await this.db
      .select()
      .from(deliveryDays)
      .where(eq(deliveryDays.id, id))
      .limit(1);

    if (!deliveryDay) {
      throw new NotFoundException('Delivery day not found');
    }

    return deliveryDay;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    // Drizzle may wrap the PostgreSQL error in `cause`.
    const candidate = 'cause' in error && error.cause ? error.cause : error;

    return (
      typeof candidate === 'object' &&
      candidate !== null &&
      'code' in candidate &&
      candidate.code === '23505' &&
      'constraint' in candidate &&
      candidate.constraint === 'delivery_days_service_date_area_unique'
    );
  }
}
