import { Global, Module } from '@nestjs/common';

import { DatabaseProvider } from './database.provider';
import { DATABASE, DATABASE_URL } from './database.types';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_URL,
      useFactory: () => process.env.DATABASE_URL,
    },
    DatabaseProvider,
    {
      provide: DATABASE,
      useFactory: (provider: DatabaseProvider) => provider.db,
      inject: [DatabaseProvider],
    },
  ],
  exports: [DATABASE, DATABASE_URL],
})
export class DatabaseModule {}
