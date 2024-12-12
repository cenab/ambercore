import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { ConnectionManager } from './connection.manager';

@Module({
  imports: [SharedModule],
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class CommonModule {} 