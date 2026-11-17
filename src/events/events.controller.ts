import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdmitEventUseCase } from './application/admit-event.use-case';
import {
  EventAdmissionUnavailableError,
} from './application/event-admission.port';
import { IngestEventDto } from './dto/ingest-event.dto';
import { ProducerApiKeyGuard } from '../security/producer-api-key.guard';

@Controller('events')
@UseGuards(ProducerApiKeyGuard)
export class EventsController {
  constructor(private readonly admitEvent: AdmitEventUseCase) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 30, ttl: 60_000, blockDuration: 60_000 } })
  async ingest(
    @Body() event: IngestEventDto,
  ): Promise<{ eventId: string; status: 'accepted' }> {
    try {
      const result = await this.admitEvent.execute(event);

      if (result.outcome === 'conflict') {
        throw new ConflictException(
          'eventId was already used with different event content.',
        );
      }

      return { eventId: result.eventId, status: 'accepted' };
    } catch (error) {
      if (error instanceof EventAdmissionUnavailableError) {
        throw new ServiceUnavailableException('Event queue is unavailable.');
      }

      throw error;
    }
  }
}
