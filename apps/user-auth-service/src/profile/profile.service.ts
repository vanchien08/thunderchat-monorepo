import { Injectable, Inject } from '@nestjs/common'
import {
  EGrpcPackages,
  EGrpcServices,
  EProviderTokens,
  ESyncDataToESWorkerType,
} from '@/utils/enums'
import { PrismaService } from '@/configs/db/prisma.service'
import { UpdateProfileDto } from './profile.dto'
import { ElasticSearchService } from '@/configs/communication/grpc/services/es.service'
import { UserConnectionService } from '@/configs/communication/grpc/services/user-connection.service'
import { ClientGrpc } from '@nestjs/microservices'

@Injectable()
export class ProfileService {
  private syncDataToESService: ElasticSearchService
  private userConnectionService: UserConnectionService

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT)
    private prisma: PrismaService,
    @Inject(EGrpcPackages.SEARCH_PACKAGE) private searchClient: ClientGrpc,
    @Inject(EGrpcPackages.CHAT_PACKAGE) private chatClient: ClientGrpc
  ) {
    this.syncDataToESService = new ElasticSearchService(
      this.searchClient.getService(EGrpcServices.ELASTIC_SEARCH_SERVICE)
    )
    this.userConnectionService = new UserConnectionService(
      this.chatClient.getService(EGrpcServices.USER_CONNECTION_SERVICE)
    )
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const data = { ...dto }
    if (
      data.birthday &&
      typeof data.birthday === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.birthday)
    ) {
      data.birthday = new Date(data.birthday).toISOString()
    }
    if (data.birthday === '' || !data.birthday) {
      delete data.birthday
    }
    const profile = await this.prisma.profile.update({
      where: { userId },
      data,
    })
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { Profile: true },
    })
    this.syncDataToESService.syncDataToES({
      type: ESyncDataToESWorkerType.UPDATE_USER,
      user: userWithProfile || undefined,
    })
    this.userConnectionService.updateUserInfo(userId, dto)
    return profile
  }

  async getProfile(userId: number) {
    return this.prisma.profile.findUnique({ where: { userId } })
  }
}
