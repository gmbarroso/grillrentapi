import 'dotenv/config';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const readNodeEnv = (): string => (process.env.NODE_ENV || '').trim().toLowerCase();

const parseAllowedOrigins = (): string[] => {
  const rawOrigins =
    process.env.API_CORS_ALLOWED_ORIGINS ||
    process.env.CORS_ALLOWED_ORIGINS ||
    process.env.CORS_ORIGINS ||
    '';
  const fromEnv = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const nodeEnv = readNodeEnv();
  const isLocalLikeEnv = nodeEnv === 'local' || nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === 'test';

  return Array.from(new Set([...(isLocalLikeEnv ? DEFAULT_ALLOWED_ORIGINS : []), ...fromEnv]));
};

async function bootstrap() {
  const nodeEnv = readNodeEnv();
  const isProductionLikeEnv = nodeEnv === 'production' || nodeEnv === 'staging';
  const loggerLevels: LogLevel[] = isProductionLikeEnv
    ? ['error', 'warn', 'log']
    : ['log', 'error', 'warn', 'debug', 'verbose'];

  const app = await NestFactory.create(AppModule, {
    logger: loggerLevels,
  });
  const configService = app.get(ConfigService);
  const allowedOrigins = parseAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, X-Internal-Service-Token, X-Request-Id',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(new ValidationPipe());
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Listening on port ${port}`);
}
bootstrap();
