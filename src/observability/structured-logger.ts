import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContext } from './request-context';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(
    level: LogLevel | 'info' | 'trace',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context = [...optionalParams]
      .reverse()
      .find((param): param is string => typeof param === 'string');
    const error =
      message instanceof Error
        ? message
        : optionalParams.find((param): param is Error => param instanceof Error);
    const fields =
      message !== null && typeof message === 'object' && !Array.isArray(message)
        ? (message as Record<string, unknown>)
        : { message };
    const entry: Record<string, unknown> = {
      ...fields,
      timestamp: new Date().toISOString(),
      level,
    };

    if (error) entry.message = error.message;
    if (context) entry.context = context;
    const stack =
      error?.stack ??
      optionalParams.find(
        (param): param is string => typeof param === 'string' && param !== context,
      );
    if (stack) entry.stack = stack;

    const requestId = RequestContext.getRequestId();
    if (requestId) entry.requestId = requestId;

    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}
