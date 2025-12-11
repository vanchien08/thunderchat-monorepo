import { ERoutes } from '@/utils/enums'
import { Controller, Get } from '@nestjs/common'
import { HealthcheckService } from './healthcheck.service'
import type { IHealthcheck } from './healthcheck.interface'

@Controller(ERoutes.HEALTHCHECK)
export class HealthcheckController implements IHealthcheck {
  constructor(private healthcheckService: HealthcheckService) {}

  @Get('/check')
  async healthcheck() {
    return await this.healthcheckService.healthcheck()
  }
}
