import { Module } from '@nestjs/common';
import { SyncController } from './sync/sync.controller';
import { SyncService } from './sync/sync.service';
import { OwnerController } from './owner/owner.controller';
import { OwnerService } from './owner/owner.service';

@Module({
  imports: [],
  controllers: [SyncController, OwnerController],
  providers: [SyncService, OwnerService],
})
export class AppModule {}
