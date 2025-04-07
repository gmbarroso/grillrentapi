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

  app.use((req, res, next) => {
    console.log(`Request from origin: ${req.headers.origin}`);
    console.log(`Request method: ${req.method}`);
    console.log(`Request path: ${req.url}`);
    next();
  });

  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.status(204).end();
      return;
    }
    next();
  });

  app.useGlobalPipes(new ValidationPipe());
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Listening on port ${port}`);
}
bootstrap();