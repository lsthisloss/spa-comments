import { Module } from '@nestjs/common';
import { CommonWsService } from './common-ws.service';
import { TestModule } from '../test/test.module';

@Module({
  imports: [TestModule],
  providers: [CommonWsService],
  exports: [CommonWsService],
})
export class CommonModule {}
