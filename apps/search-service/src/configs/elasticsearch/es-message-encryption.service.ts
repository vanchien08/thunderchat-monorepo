import { Injectable } from '@nestjs/common'
import ESMessageEncryptor from '@/message/security/es-message-encryptor'
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto'
import { MessageMappingsService } from '@/message-mappings/message-mappings.service'

@Injectable()
export class ESMessageEncryptionService {
  private ESMsgEncryptor: ESMessageEncryptor | null = null
  private symmetricTextEncryptor: SymmetricTextEncryptor = new SymmetricTextEncryptor()

  constructor(private messageMappingService: MessageMappingsService) {}

  async getESMessageEncryptor(): Promise<ESMessageEncryptor> {
    if (this.ESMsgEncryptor) return this.ESMsgEncryptor
    return await this.initESMessageEncryptor()
  }

  private async initESMessageEncryptor(): Promise<ESMessageEncryptor> {
    let messageMappings = await this.messageMappingService.getMessageMappings()
    if (messageMappings) {
      const { mappings, key, dek } = messageMappings
      const decryptedDek = this.symmetricTextEncryptor.decrypt(
        dek,
        process.env.MESSAGE_MAPPINGS_SECRET_KEY
      )
      this.ESMsgEncryptor = new ESMessageEncryptor(
        this.symmetricTextEncryptor.decrypt(key, decryptedDek),
        this.symmetricTextEncryptor.decrypt(mappings, decryptedDek),
        decryptedDek
      )
      return this.ESMsgEncryptor
    }
    this.ESMsgEncryptor = new ESMessageEncryptor(
      ESMessageEncryptor.generateESMessageSecretKey(),
      null,
      this.symmetricTextEncryptor.generateEncryptionKey()
    )
    return this.ESMsgEncryptor
  }

  async encryptTextByESEncryptor(text: string): Promise<string> {
    if (!this.ESMsgEncryptor) {
      this.ESMsgEncryptor = await this.initESMessageEncryptor()
    }
    return this.ESMsgEncryptor.encrypt(text)
  }

  async updateMessageMappings(): Promise<void> {
    if (this.ESMsgEncryptor) {
      await this.messageMappingService.updateMessageMappings(
        this.ESMsgEncryptor.getMappings(),
        this.ESMsgEncryptor.getSecretKey(),
        this.ESMsgEncryptor.getDek()
      )
    }
  }
}
