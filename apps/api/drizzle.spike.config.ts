import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/spikes/drizzle-migration-schema.ts',
  out: './src/spikes/generated-migrations',
});
