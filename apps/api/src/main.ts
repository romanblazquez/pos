import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Swagger — available at /api/docs in all environments
  const swaggerConfig = new DocumentBuilder()
    .setTitle('BoardGame Market API')
    .setDescription(
      'REST API for the BoardGame Market platform — marketplace search, seller auth, ' +
      'catalog management, checkout, ranking, and connector sync.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'seller-jwt',
    )
    .addTag('auth', 'Seller and customer authentication')
    .addTag('marketplace', 'Public product search and listing comparison')
    .addTag('checkout', 'Cart validation and MercadoPago Checkout Pro')
    .addTag('sellers', 'Seller management')
    .addTag('catalog', 'POS product catalog (internal)')
    .addTag('connectors', 'Connector sync — Tiendanube, Shopify, etc.')
    .addTag('admin', 'Admin — catalog matching, orders, ranking, BGG import')
    .addTag('health', 'Liveness and readiness probes')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`[api] Retail OS API listening on http://localhost:${port}`);
  console.log(`[api] Swagger docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
