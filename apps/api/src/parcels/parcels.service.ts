import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import { DATABASE, type AppDatabase } from '../db/database.types';
import { deliveryDays, parcels, stops } from '../db/schema';

import { AssignParcelStopDto } from './dto/assign-parcel-stop.dto';
import { CreateParcelDto } from './dto/create-parcel.dto';

@Injectable()
export class ParcelsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: AppDatabase,
  ) {}

  // ALT-020: Create a parcel
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

  // ALT-020: List parcels for a delivery day
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

  // ALT-021: Assign a parcel to a delivery stop
  async assignToStop(
    dayId: string,
    parcelId: string,
    dto: AssignParcelStopDto,
  ) {
    // Verify the delivery day exists.
    const [day] = await this.db
      .select({ id: deliveryDays.id })
      .from(deliveryDays)
      .where(eq(deliveryDays.id, dayId));

    if (!day) {
      throw new NotFoundException('Delivery day not found');
    }

    // Verify the parcel belongs to this delivery day.
    const [parcel] = await this.db
      .select({
        id: parcels.id,
        deliveryDayId: parcels.deliveryDayId,
      })
      .from(parcels)
      .where(eq(parcels.id, parcelId));

    if (!parcel || parcel.deliveryDayId !== dayId) {
      throw new NotFoundException('Parcel not found for delivery day');
    }

    // Verify the stop exists.
    const [stop] = await this.db
      .select({
        id: stops.id,
        deliveryDayId: stops.deliveryDayId,
      })
      .from(stops)
      .where(eq(stops.id, dto.stopId));

    if (!stop) {
      throw new NotFoundException('Stop not found');
    }

    // Prevent assignments across different delivery days.
    if (stop.deliveryDayId !== dayId) {
      throw new BadRequestException(
        'Parcel and stop must belong to the same delivery day',
      );
    }

    // Assign the parcel to the stop.
    const [updatedParcel] = await this.db
      .update(parcels)
      .set({ stopId: stop.id })
      .where(eq(parcels.id, parcelId))
      .returning();

    return updatedParcel;
  }

  // Translate tracking-number uniqueness violations to HTTP 409.
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
