import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { SyncDataToESService } from './sync-data-to-ES/sync-data-to-es.service'
import { DataToSync } from 'protos/generated/search'
import { EGrpcServices } from '@/utils/enums'
import type { IElasticSearchGrpcController } from './elasticsearch.interface'

@Controller()
export class ElasticSearchGrpcController implements IElasticSearchGrpcController {
  constructor(private readonly syncDataToESService: SyncDataToESService) {}

  @GrpcMethod(EGrpcServices.ELASTICSEARCH_SERVICE, 'SyncDataToES')
  async SyncDataToES(data: DataToSync) {
    await this.syncDataToESService.syncDataToES(JSON.parse(data.dataToSyncJson))
    return {}
  }
}
