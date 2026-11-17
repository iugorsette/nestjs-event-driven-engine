import {
  IsISO8601,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class IngestEventDto {
  @IsUUID('4')
  eventId!: string;

  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
  eventType!: string;

  @IsInt()
  @Min(1)
  schemaVersion!: number;

  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  occurredAt!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
