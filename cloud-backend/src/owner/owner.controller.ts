import { Controller, Get } from '@nestjs/common';
import { OwnerService, CloudOwnerMetrics } from './owner.service';

@Controller('api/v1/owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('metrics')
  async getMetrics(): Promise<CloudOwnerMetrics> {
    return this.ownerService.getExecutiveMetrics();
  }
}
