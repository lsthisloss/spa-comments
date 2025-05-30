import { Module } from '@nestjs/common';
import { CommonWsService } from './common-ws.service';

@Module({
  providers: [CommonWsService],
  exports: [CommonWsService],
})
export class CommonModule {}
