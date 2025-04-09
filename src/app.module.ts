import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './api/user/user.module';
import { ResourceModule } from './api/resource/resource.module';
import { BookingModule } from './api/booking/booking.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { NoticeModule } from './api/notice/notice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
        ssl: {
          rejectUnauthorized: false,
        },
      }),
      inject: [ConfigService],
    }),
    UserModule,
    ResourceModule,
    BookingModule,
    NoticeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
