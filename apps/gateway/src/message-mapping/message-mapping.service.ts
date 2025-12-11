import { Inject } from '@nestjs/common'
import { EMsgEncryptionAlgorithms, EProviderTokens } from '@/utils/enums'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import type { TMessageMappings } from '@/utils/entities/message-mappings.entity'
import { SymmetricEncryptor } from '@/utils/crypto/symmetric-encryption.crypto'

@Injectable()
export class MessageMappingService {
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService) {}

  async findMessageMapping(userId: number): Promise<TMessageMappings | null> {
    const messageMapping = null
    return messageMapping
  }

  async createMessageMapping(userId: number, mappings: string): Promise<void> {
    const symmetricEncryptor = new SymmetricEncryptor(EMsgEncryptionAlgorithms.AES_256_ECB)
    // await this.PrismaService.messageMapping.create({
    //   data: {
    //     userId,
    //     mappings,
    //     key: symmetricEncryptor.encrypt(
    //       symmetricEncryptor.generateSecretKey(),
    //       process.env.DECRYPT_USER_KEY_MASTER_KEY
    //     ),
    //   },
    // })
  }
}
