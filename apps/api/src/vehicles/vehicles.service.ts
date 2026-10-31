import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { DATABASE, type AppDatabase } from '../db/database.types';
import { vehicles } from '../db/schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: AppDatabase,
  ) {}

  async create(dto: CreateVehicleDto) {
    try {
      const [vehicle] = await this.db
        .insert(vehicles)
        .values({
          registrationNumber: dto.registrationNumber,
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        })
        .returning();

      return vehicle;
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A vehicle with this registration number already exists',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.db
      .select()
      .from(vehicles)
      .orderBy(asc(vehicles.registrationNumber));
  }

  async findOne(id: string) {
    const [vehicle] = await this.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const databaseError = error as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };

    if (
      databaseError.code === '23505' &&
      databaseError.constraint === 'vehicles_registration_number_unique'
    ) {
      return true;
    }

    if (databaseError.cause) {
      return this.isUniqueViolation(databaseError.cause);
    }

    return false;
  }
}
