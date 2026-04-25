import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Allow large file uploads (videos) — 10 minute timeout
  const server = app.getHttpServer();
  server.setTimeout(600000);

  // Graceful shutdown — ensures Prisma disconnects cleanly on SIGINT/SIGTERM
  // in production (k8s rolling deploy, docker stop, etc.)
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  Logger.log(`Uteo backend up on :${port}`, 'Bootstrap');
}
bootstrap();
