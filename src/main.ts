import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  const configService = app.get(ConfigService);

  const allowedOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  app.use((req, res, next) => {
    res.cookie('token', 'your-jwt-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600000,
    });
    next();
  });

  app.useGlobalPipes(new ValidationPipe());
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Listening on port ${port}`);
}
bootstrap();

