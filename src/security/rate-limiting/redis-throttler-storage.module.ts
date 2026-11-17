import { Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config';
import { RedisThrottlerStorage } from './redis-throttler-storage';

@Module({
  providers: [
    {
      provide: RedisThrottlerStorage,
      useFactory: () => new RedisThrottlerStorage(loadAppConfig().redis),
    },
  ],
  exports: [RedisThrottlerStorage],
})
export class RedisThrottlerStorageModule {}
