import { PrismaService } from '@/configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { Global, Module, Provider } from '@nestjs/common'
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module'
import { LoggerModule } from '../logger/logger.module'

const prisma_provider: Provider = {
   provide: EProviderTokens.PRISMA_CLIENT,
   useClass: PrismaService,
}

@Global()
@Module({
   imports: [ElasticsearchModule, LoggerModule],
   providers: [prisma_provider],
   exports: [prisma_provider],
})
export class PrismaModule {}
