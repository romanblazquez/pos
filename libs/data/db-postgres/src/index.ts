export { PrismaService } from './prisma.service.js';
export { PrismaModule } from './prisma.module.js';

export interface PostgresConfig {
  databaseUrl: string;
}

export const CENTRAL_SCHEMA_PATH = 'libs/data/db-postgres/prisma/schema.prisma';
