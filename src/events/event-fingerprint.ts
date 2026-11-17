import { createHash } from 'node:crypto';
import { IngestEventDto } from './dto/ingest-event.dto';

export type EventSubmissionClassification = 'new' | 'duplicate' | 'conflict';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }

  return value;
}

export function fingerprintEvent(event: IngestEventDto): string {
  const serialized = JSON.stringify(canonicalize(event));

  if (serialized === undefined) {
    throw new Error('Event envelope could not be serialized as JSON.');
  }

  return createHash('sha256').update(serialized).digest('hex');
}

export function classifyEventSubmission(
  event: IngestEventDto,
  // The caller loads this value using event.eventId as the lookup key.
  acceptedFingerprint?: string,
): EventSubmissionClassification {
  if (acceptedFingerprint === undefined) {
    return 'new';
  }

  return fingerprintEvent(event) === acceptedFingerprint
    ? 'duplicate'
    : 'conflict';
}
