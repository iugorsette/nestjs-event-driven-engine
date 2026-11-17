import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { RequestContextMiddleware } from './observability/request-context.middleware';
import { StructuredLogger } from './observability/structured-logger';
import { EventsQueueModule } from './events/queue/events-queue.module';
import { loadAppConfig } from './config/app-config';

const redisConnection = loadAppConfig().redis;

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection }),
    EventsQueueModule,
  ],
  controllers: [AppController],
  providers: [StructuredLogger, RequestContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
