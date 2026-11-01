import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import { DATABASE, type AppDatabase } from '../db/database.types';
import { routes, stops } from '../db/schema';
import { CreateStopDto } from './dto/create-stop.dto';

@Injectable()
export class StopsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: AppDatabase,
  ) {}

  async create(routeId: string, dto: CreateStopDto) {
    const [route] = await this.db
      .select({
        id: routes.id,
        deliveryDayId: routes.deliveryDayId,
        status: routes.status,
      })
      .from(routes)
      .where(eq(routes.id, routeId));

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.status !== 'draft') {
      throw new ConflictException('Stops can only be created on draft routes');
    }

    try {
      const [stop] = await this.db
        .insert(stops)
        .values({
          routeId: route.id,
          deliveryDayId: route.deliveryDayId,
          sequence: dto.sequence,
          locationKey: dto.locationKey.trim(),
          position: sql`ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)`,
        })
        .returning();

      return stop;
    } catch (error: unknown) {
      if (this.isStopSequenceConflict(error)) {
        throw new ConflictException(
          'Stop sequence already exists on this route',
        );
      }

      throw error;
    }
  }

  async findByRoute(routeId: string) {
    const [route] = await this.db
      .select({ id: routes.id })
      .from(routes)
      .where(eq(routes.id, routeId));

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return this.db
      .select({
        id: stops.id,
        routeId: stops.routeId,
        deliveryDayId: stops.deliveryDayId,
        sequence: stops.sequence,
        locationKey: stops.locationKey,
        status: stops.status,
        longitude: sql<number>`ST_X(${stops.position})`.mapWith(Number),
        latitude: sql<number>`ST_Y(${stops.position})`.mapWith(Number),
      })
      .from(stops)
      .where(eq(stops.routeId, routeId))
      .orderBy(asc(stops.sequence));
  }

  private isStopSequenceConflict(error: unknown): boolean {
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

    return code === '23505' && constraint === 'stops_route_sequence_unique';
  }
}
