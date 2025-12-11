import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import { Global, Module, Provider } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';

const prisma_provider: Provider = {
  provide: EProviderTokens.PRISMA_CLIENT,
  useClass: PrismaService,
};

@Global()
@Module({
  imports: [LoggerModule],
  providers: [prisma_provider, PrismaService],
  exports: [prisma_provider, PrismaService],
})
export class PrismaModule {}
