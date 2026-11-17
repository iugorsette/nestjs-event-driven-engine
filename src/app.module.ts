import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { RequestContextMiddleware } from './observability/request-context.middleware';
import { StructuredLogger } from './observability/structured-logger';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [StructuredLogger, RequestContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
