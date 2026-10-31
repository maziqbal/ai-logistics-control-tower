import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { eq, and, sql } from 'drizzle-orm';
import { DATABASE, type AppDatabase } from '../db/database.types';
import { deliveryDays, drivers, routes, vehicles } from '../db/schema';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteAssignmentDto } from './dto/update-route-assignment.dto';

@Injectable()
export class RoutesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: AppDatabase,
  ) {}

  async create(deliveryDayId: string, dto: CreateRouteDto) {
    const [deliveryDay] = await this.db
      .select({ id: deliveryDays.id })
      .from(deliveryDays)
      .where(eq(deliveryDays.id, deliveryDayId));

    if (!deliveryDay) {
      throw new NotFoundException('Delivery day not found');
    }

    if (dto.driverId) {
      const [driver] = await this.db
        .select({
          id: drivers.id,
          active: drivers.active,
        })
        .from(drivers)
        .where(eq(drivers.id, dto.driverId));

      if (!driver) {
        throw new NotFoundException('Driver not found');
      }

      if (!driver.active) {
        throw new ConflictException('Driver is inactive');
      }
    }

    if (dto.vehicleId) {
      const [vehicle] = await this.db
        .select({
          id: vehicles.id,
          active: vehicles.active,
        })
        .from(vehicles)
        .where(eq(vehicles.id, dto.vehicleId));

      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      if (!vehicle.active) {
        throw new ConflictException('Vehicle is inactive');
      }
    }

    try {
      const [route] = await this.db
        .insert(routes)
        .values({
          deliveryDayId,
          driverId: dto.driverId ?? null,
          vehicleId: dto.vehicleId ?? null,
        })
        .returning();

      return route;
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Driver or vehicle is already assigned on this delivery day',
        );
      }

      throw error;
    }
  }

  async findByDeliveryDay(deliveryDayId: string) {
    const [deliveryDay] = await this.db
      .select({ id: deliveryDays.id })
      .from(deliveryDays)
      .where(eq(deliveryDays.id, deliveryDayId));

    if (!deliveryDay) {
      throw new NotFoundException('Delivery day not found');
    }

    return this.db
      .select()
      .from(routes)
      .where(eq(routes.deliveryDayId, deliveryDayId))
      .orderBy(routes.id);
  }

  async updateAssignment(routeId: string, dto: UpdateRouteAssignmentDto) {
    if (dto.driverId === undefined && dto.vehicleId === undefined) {
      throw new BadRequestException(
        'At least one assignment field is required',
      );
    }

    const [existingRoute] = await this.db
      .select()
      .from(routes)
      .where(eq(routes.id, routeId));

    if (!existingRoute) {
      throw new NotFoundException('Route not found');
    }

    if (existingRoute.status !== 'draft') {
      throw new ConflictException(
        'Assignments can only be changed on draft routes',
      );
    }

    if (
      dto.driverId !== undefined &&
      dto.driverId !== null &&
      dto.driverId !== existingRoute.driverId
    ) {
      const [driver] = await this.db
        .select({ id: drivers.id, active: drivers.active })
        .from(drivers)
        .where(eq(drivers.id, dto.driverId));

      if (!driver) {
        throw new NotFoundException('Driver not found');
      }

      if (!driver.active) {
        throw new ConflictException('Driver is inactive');
      }
    }

    if (
      dto.vehicleId !== undefined &&
      dto.vehicleId !== null &&
      dto.vehicleId !== existingRoute.vehicleId
    ) {
      const [vehicle] = await this.db
        .select({ id: vehicles.id, active: vehicles.active })
        .from(vehicles)
        .where(eq(vehicles.id, dto.vehicleId));

      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      if (!vehicle.active) {
        throw new ConflictException('Vehicle is inactive');
      }
    }

    const nextDriverId =
      dto.driverId === undefined ? existingRoute.driverId : dto.driverId;

    const nextVehicleId =
      dto.vehicleId === undefined ? existingRoute.vehicleId : dto.vehicleId;

    if (
      nextDriverId === existingRoute.driverId &&
      nextVehicleId === existingRoute.vehicleId
    ) {
      return existingRoute;
    }

    try {
      const [updatedRoute] = await this.db
        .update(routes)
        .set({
          driverId: nextDriverId,
          vehicleId: nextVehicleId,
          version: sql`${routes.version} + 1`,
        })
        .where(
          and(
            eq(routes.id, routeId),
            eq(routes.status, 'draft'),
            eq(routes.version, existingRoute.version),
          ),
        )
        .returning();

      if (!updatedRoute) {
        throw new ConflictException(
          'Route was modified by another request; please retry',
        );
      }

      return updatedRoute;
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Driver or vehicle is already assigned on this delivery day',
        );
      }

      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const databaseError = error as {
      code?: string;
      cause?: { code?: string };
    };

    return (
      databaseError.code === '23505' || databaseError.cause?.code === '23505'
    );
  }
}
