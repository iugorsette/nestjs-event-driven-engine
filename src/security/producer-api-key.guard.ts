import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config/app-config';

@Injectable()
export class ProducerApiKeyGuard implements CanActivate {
  private readonly expectedDigest: Buffer | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.expectedDigest = config.ingestApiKey
      ? createHash('sha256').update(config.ingestApiKey).digest()
      : undefined;
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedDigest) {
      throw new ServiceUnavailableException(
        'Event ingestion authentication is not configured.',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string | string[] };
    }>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string'
        ? /^Bearer ([\x21-\x7E]{32,256})$/i.exec(header)
        : null;
    const suppliedDigest = createHash('sha256')
      .update(match?.[1] ?? '')
      .digest();
    const matches = timingSafeEqual(this.expectedDigest, suppliedDigest);

    if (!match || !matches) {
      throw new UnauthorizedException('A valid producer bearer token is required.');
    }

    return true;
  }
}
