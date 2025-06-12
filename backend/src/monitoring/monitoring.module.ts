import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringController } from './monitoring.controoller';
import { QueueMonitorService } from './queue-monitor.service';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [ScheduleModule.forRoot(), RabbitMQModule],
  controllers: [MonitoringController],
  providers: [QueueMonitorService],
  exports: [QueueMonitorService],
})
export class MonitoringModule {}
