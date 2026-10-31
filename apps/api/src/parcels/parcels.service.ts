import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { DATABASE, type AppDatabase } from '../db/database.types';
import { deliveryDays, parcels } from '../db/schema';
import { CreateParcelDto } from './dto/create-parcel.dto';

@Injectable()
export class ParcelsService {
  constructor(@Inject(DATABASE) private readonly db: AppDatabase) {}

  async create(dayId: string, dto: CreateParcelDto) {
    const [day] = await this.db
      .select({ id: deliveryDays.id })
      .from(deliveryDays)
      .where(eq(deliveryDays.id, dayId));

    if (!day) {
      throw new NotFoundException('Delivery day not found');
    }

    try {
      const [parcel] = await this.db
        .insert(parcels)
        .values({
          deliveryDayId: day.id,
          trackingNumber: dto.trackingNumber.trim(),
          destination: dto.destination.trim(),
          locationKey: dto.locationKey.trim(),
          position: sql`ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)`,
        })
        .returning();

      return parcel;
    } catch (error: unknown) {
      if (this.isTrackingNumberConflict(error)) {
        throw new ConflictException('Tracking number already exists');
      }

      throw error;
    }
  }

  async findByDeliveryDay(dayId: string) {
    const [day] = await this.db
      .select({ id: deliveryDays.id })
      .from(deliveryDays)
      .where(eq(deliveryDays.id, dayId));

    if (!day) {
      throw new NotFoundException('Delivery day not found');
    }

    return this.db
      .select()
      .from(parcels)
      .where(eq(parcels.deliveryDayId, dayId))
      .orderBy(asc(parcels.trackingNumber), asc(parcels.id));
  }

  private isTrackingNumberConflict(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const databaseError = error as {
      code?: string;
      constraint?: string;
      cause?: {
        code?: string;
        constraint?: string;
      };
    };

    const code = databaseError.code ?? databaseError.cause?.code;
    const constraint =
      databaseError.constraint ?? databaseError.cause?.constraint;

    return code === '23505' && constraint === 'parcels_tracking_number_unique';
  }
}
