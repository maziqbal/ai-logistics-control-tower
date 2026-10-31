import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';
import { DATABASE_URL, type AppDatabase } from './database.types';

@Injectable()
export class DatabaseProvider implements OnModuleInit, OnApplicationShutdown {
  private readonly pool: Pool;
  readonly db: AppDatabase;

  constructor(@Inject(DATABASE_URL) databaseUrl: string) {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL must be a valid URL');
    }

    if (
      parsedUrl.protocol !== 'postgresql:' &&
      parsedUrl.protocol !== 'postgres:'
    ) {
      throw new Error('DATABASE_URL must use PostgreSQL');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
