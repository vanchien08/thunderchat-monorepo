import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto'
import { Injectable } from '@nestjs/common'
import type { TMessage } from '@/utils/entities/message.entity'
import type { TEncryptTextRes } from './encrypt-message.type'
import type { TMessageMedia } from '@/utils/entities/message-media.entity'

@Injectable()
export class EncryptMessageService {
  private symmetricTextEncryptor: SymmetricTextEncryptor

  constructor() {
    this.symmetricTextEncryptor = new SymmetricTextEncryptor()
    console.log(
      '>>> SymmetricTextEncryptor initialized:',
      this.symmetricTextEncryptor.generateEncryptionKey()
    )
  }

  private generateDEK(): string {
    return this.symmetricTextEncryptor.generateEncryptionKey()
  }

  encryptText(originalText: string): TEncryptTextRes {
    if (originalText) {
      const dek = this.generateDEK()
      const encryptedDek = this.symmetricTextEncryptor.encrypt(
        dek,
        process.env.MESSAGES_ENCRYPTION_SECRET_KEY
      )
      return {
        encryptedContent: this.symmetricTextEncryptor.encrypt(originalText, dek),
        encryptedDek,
      }
    }
    return { encryptedContent: '', encryptedDek: '' }
  }

  decryptText(encryptedContent: string, dek: string): string {
    if (!encryptedContent || !dek) {
      return ''
    }
    return this.symmetricTextEncryptor.decrypt(
      encryptedContent,
      this.symmetricTextEncryptor.decrypt(dek, process.env.MESSAGES_ENCRYPTION_SECRET_KEY)
    )
  }

  decryptMessage<Message extends TMessage>(message: Message): Message {
    let mediaData = message['Media'] as TMessageMedia | undefined
    if (mediaData && mediaData.fileName && mediaData.dek) {
      mediaData = {
        ...mediaData,
        fileName: this.decryptText(mediaData.fileName, mediaData.dek),
      }
    }
    return {
      ...message,
      content: this.decryptText(message.content, message.dek),
      ...(mediaData ? { Media: mediaData } : {}),
    }
  }

  decryptMessages<Message extends TMessage>(messages: Message[]): Message[] {
    return messages.map((msg) => this.decryptMessage(msg))
  }
}
