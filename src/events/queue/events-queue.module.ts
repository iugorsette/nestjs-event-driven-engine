import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { AdmitEventUseCase } from '../application/admit-event.use-case'
import { EVENT_ADMISSION_PORT } from '../application/event-admission.port'
import { BullMqEventAdmissionAdapter } from './bullmq-event-admission.adapter'
import { EVENT_QUEUE_NAME } from './event-queue.constants'

@Module({
  imports: [BullModule.registerQueue({ name: EVENT_QUEUE_NAME })],
  providers: [
    BullMqEventAdmissionAdapter,
    { provide: EVENT_ADMISSION_PORT, useExisting: BullMqEventAdmissionAdapter },
    AdmitEventUseCase,
  ],
  exports: [AdmitEventUseCase],
})
export class EventsQueueModule {}
