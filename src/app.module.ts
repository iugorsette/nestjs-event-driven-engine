import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { EventsController } from './events/events.controller';
import { RequestContextMiddleware } from './observability/request-context.middleware';
import { StructuredLogger } from './observability/structured-logger';
import { EventsQueueModule } from './events/queue/events-queue.module';
import { APP_CONFIG, loadAppConfig } from './config/app-config';
import { RateLimitingModule } from './security/rate-limiting/rate-limiting.module';
import { ProducerApiKeyGuard } from './security/producer-api-key.guard';

const appConfig = loadAppConfig();

@Module({
  imports: [
    BullModule.forRoot({ connection: appConfig.redis }),
    EventsQueueModule,
    RateLimitingModule,
  ],
  controllers: [AppController, EventsController],
  providers: [
    StructuredLogger,
    RequestContextMiddleware,
    ProducerApiKeyGuard,
    { provide: APP_CONFIG, useValue: appConfig },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
