import { PrismaService } from '@/configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { Inject, Injectable } from '@nestjs/common'
import { MessageMediaType } from '@prisma/client'

@Injectable()
export class MessageMediaService {
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}

  async findMessageMediaByURL(url: string) {
    return this.prismaService.messageMedia.findUnique({
      where: { url },
    })
  }

  async createMessageMedia(
    mediaUrl: string,
    mediaType: MessageMediaType,
    mediaMimeType: string,
    mediaFileName: string,
    mediaFileSize: number,
    mediaThumbnailUrl?: string,
    dek?: string,
    iv?: string,
    authTag?: string
  ) {
    return this.prismaService.messageMedia.create({
      data: {
        url: mediaUrl,
        type: mediaType,
        fileName: mediaFileName,
        fileSize: mediaFileSize,
        fileType: mediaMimeType,
        thumbnailUrl: mediaThumbnailUrl || '',
        dek: dek || '',
        dekVersionCode: process.env.MESSAGES_ENCRYPTION_VERSION_CODE,
        iv: iv || '',
        authTag: authTag || '',
      },
    })
  }

  async updateThumbnailUrl(thumbnailUrl: string, msgMediaId?: number, msgMediaUrl?: string) {
    return this.prismaService.messageMedia.update({
      where: { id: msgMediaId, url: msgMediaUrl },
      data: { thumbnailUrl },
    })
  }
}
