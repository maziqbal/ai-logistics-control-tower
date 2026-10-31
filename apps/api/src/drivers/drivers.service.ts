import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { DATABASE, type AppDatabase } from '../db/database.types';
import { drivers } from '../db/schema';
import { CreateDriverDto } from './dto/create-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    @Inject(DATABASE)
    private readonly db: AppDatabase,
  ) {}

  async create(dto: CreateDriverDto) {
    const [driver] = await this.db
      .insert(drivers)
      .values({
        name: dto.name,
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      })
      .returning();

    return driver;
  }

  async findAll() {
    return this.db.select().from(drivers).orderBy(asc(drivers.name));
  }

  async findOne(id: string) {
    const [driver] = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.id, id))
      .limit(1);

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }
}
