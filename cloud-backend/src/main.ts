import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('AmeerPerfumesCloudBootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Ameer Perfumes Cloud Sync Backend listening on http://localhost:${port}`);
  logger.log(`PostgreSQL Mirror & Periodic 15-Min Background Ingestion Active.`);
}

bootstrap();
