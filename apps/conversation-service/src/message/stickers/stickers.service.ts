import { PrismaService } from '@/configs/db/prisma.service'
import { TSticker, TStickerCategory } from '@/utils/entities/sticker.entity'
import { EProviderTokens } from '@/utils/enums'
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class StickersService {
  private readonly GREETING_STICKER_ID: number = 13

  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService) {}

  async getStickersByCategoryId(categoryId: number, offsetId?: number): Promise<TSticker[]> {
    const stickers = await this.PrismaService.sticker.findMany({
      where: {
        id: offsetId ? { gt: offsetId } : undefined, // Lấy sticker có ID lớn hơn offset
        categoryId,
      },
      orderBy: { id: 'asc' }, // Sắp xếp theo sticker_id
    })
    return stickers
  }

  async getAllStickerCategories(): Promise<TStickerCategory[]> {
    return await this.PrismaService.stickerCategory.findMany()
  }

  async getGreetingSticker(): Promise<TSticker | null> {
    // hard code
    const sticker = await this.PrismaService.sticker.findUnique({
      where: {
        id: this.GREETING_STICKER_ID,
      },
    })
    return sticker
  }
}
