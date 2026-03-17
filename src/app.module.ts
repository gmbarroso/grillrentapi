import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './api/user/user.module';
import { ResourceModule } from './api/resource/resource.module';
import { BookingModule } from './api/booking/booking.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { NoticeModule } from './api/notice/notice.module';
import { SecurityModule } from './shared/security/security.module';
import { OrganizationModule } from './api/organization/organization.module';
import { WhatsappSettingsModule } from './api/whatsapp-settings/whatsapp-settings.module';
import { MessageModule } from './api/message/message.module';
import { WhatsappWebhookModule } from './api/whatsapp-webhook/whatsapp-webhook.module';

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
        logging: configService.get<string>('NODE_ENV') !== 'production',
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
    MessageModule,
    WhatsappSettingsModule,
    WhatsappWebhookModule,
    OrganizationModule,
    SecurityModule,
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
