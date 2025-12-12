import type { SyncDataToESWorkerMessageDTO } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.dto'
import type { ElasticSearchService as ElasticSearchServiceType } from 'protos/generated/search'
import { firstValueFrom } from 'rxjs'

export class ElasticSearchService {
  constructor(private instance: ElasticSearchServiceType) {}

  async syncDataToES(dataToSync: SyncDataToESWorkerMessageDTO): Promise<void> {
    await firstValueFrom(this.instance.SyncDataToES({ dataToSyncJson: JSON.stringify(dataToSync) }))
  }
}
