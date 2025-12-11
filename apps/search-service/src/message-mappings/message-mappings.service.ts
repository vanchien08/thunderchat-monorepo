import { PrismaService } from '@/configs/db/prisma.service'
import { EProviderTokens } from '@/utils/enums'
import { Inject, Injectable } from '@nestjs/common'
import { TMessageMappings } from '@/utils/entities/message-mappings.entity'
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto'

@Injectable()
export class MessageMappingsService {
  private SymmetricTextEncryptor: SymmetricTextEncryptor = new SymmetricTextEncryptor()

  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}

  async getMessageMappings(): Promise<TMessageMappings | null> {
    return this.prismaService.messageMapping.findUnique({
      where: { versionCode: process.env.MESSAGE_MAPPINGS_VERSION_CODE },
    })
  }

  async createMessageMappings(
    encryptedMappings: string,
    encryptedMappingsKey: string,
    encryptedDek: string
  ): Promise<TMessageMappings> {
    const existing = await this.getMessageMappings()
    if (existing) {
      return existing
    }
    return await this.prismaService.messageMapping.create({
      data: {
        mappings: encryptedMappings,
        key: encryptedMappingsKey,
        dek: encryptedDek,
        versionCode: process.env.MESSAGE_MAPPINGS_VERSION_CODE,
      },
    })
  }

  async updateMessageMappings(
    originalMappings: string,
    originalMappingsKey: string,
    originalDek: string
  ): Promise<TMessageMappings> {
    const existing = await this.getMessageMappings()
    const encryptedMappings = this.SymmetricTextEncryptor.encrypt(originalMappings, originalDek)
    if (existing) {
      await this.prismaService.messageMapping.update({
        where: { id: existing.id },
        data: { mappings: encryptedMappings },
      })
      return existing
    }
    return await this.createMessageMappings(
      encryptedMappings,
      this.SymmetricTextEncryptor.encrypt(originalMappingsKey, originalDek),
      this.SymmetricTextEncryptor.encrypt(originalDek, process.env.MESSAGE_MAPPINGS_SECRET_KEY)
    )
  }
}
