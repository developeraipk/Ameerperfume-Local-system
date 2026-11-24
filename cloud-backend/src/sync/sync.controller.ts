import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncPushPayloadDto, SyncPushResponseDto, SyncStatusResponseDto } from './sync.dto';

@Controller('api/v1/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  async pushSyncBatch(@Body() payload: SyncPushPayloadDto): Promise<SyncPushResponseDto> {
    return this.syncService.processSyncPush(payload);
  }

  @Get('status')
  async getStatus(): Promise<SyncStatusResponseDto> {
    return this.syncService.getSyncStatus();
  }
}
