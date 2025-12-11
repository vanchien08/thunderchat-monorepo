import { DataToSync } from 'protos/generated/search'

export interface IElasticSearchGrpcController {
  SyncDataToES(data: DataToSync): Promise<{}>
}
