import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/**
 * Retail OS central API — NestJS modular monolith entry.
 * Receives synced sales from terminals and (on the roadmap) serves master data,
 * reporting, auth and payment webhooks. Run with `pnpm dev:api`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] Retail OS API listening on http://localhost:${port}`);
}

void bootstrap();
