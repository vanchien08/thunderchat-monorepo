import { Injectable, Inject } from '@nestjs/common'
import { EInternalEvents, EProviderTokens, ESyncDataToESWorkerType } from '@/utils/enums'
import { PrismaService } from '@/configs/db/prisma.service'
import { UpdateProfileDto } from './profile.dto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'

@Injectable()
export class ProfileService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT)
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private syncDataToESService: SyncDataToESService
  ) {}

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
      data: userWithProfile || undefined,
    })
    this.eventEmitter.emit(EInternalEvents.UPDATE_USER_INFO, userId, dto)
    return profile
  }

  async getProfile(userId: number) {
    return this.prisma.profile.findUnique({ where: { userId } })
  }
}
