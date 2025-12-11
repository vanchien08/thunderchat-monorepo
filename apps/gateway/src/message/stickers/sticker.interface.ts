import type { TSticker, TStickerCategory } from '@/utils/entities/sticker.entity'
import type { GetStickersDTO } from './sticker.dto'

export interface IStickerController {
  getStickers(payload: GetStickersDTO): Promise<TSticker[]>
  getAllStickerCategories(): Promise<TStickerCategory[]>
  getGreetingSticker(): Promise<TSticker | null>
}
