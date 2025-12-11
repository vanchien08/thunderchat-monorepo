import type { TMsgToken } from '@/messaging/messaging.type'
import type { TUserId } from '@/user/user.type'
import ms from 'ms'

export class MessageTokensManager {
  private readonly cleanMsgTokenTimeout: number = ms('1h')
  private readonly uniqueMsgTokens = new Map<TUserId, TMsgToken[]>()

  printOutTokens(): void {
    for (const [key, value] of this.uniqueMsgTokens) {
      console.log(`>>> key: ${key} - something: ${value}`)
    }
  }

  isUniqueToken(userId: TUserId, token: TMsgToken): boolean {
    const preTokens = this.uniqueMsgTokens.get(userId)
    if (preTokens && preTokens.length > 0) {
      if (preTokens.includes(token)) {
        return false
      }
      this.uniqueMsgTokens.set(userId, [...preTokens, token])
    } else {
      this.uniqueMsgTokens.set(userId, [token])
    }
    this.cleanTokenAutomatically(userId, token)
    return true
  }

  removeAllTokens(userId: TUserId) {
    this.uniqueMsgTokens.delete(userId)
  }

  removeSingleToken(userId: TUserId, token: TMsgToken) {
    const tokens = this.uniqueMsgTokens.get(userId)
    if (tokens && tokens.length > 0) {
      this.uniqueMsgTokens.set(
        userId,
        tokens.filter((tk) => tk !== token)
      )
    }
  }

  cleanTokenAutomatically(userId: TUserId, token: TMsgToken): void {
    setTimeout(() => {
      this.removeSingleToken(userId, token)
    }, this.cleanMsgTokenTimeout)
  }
}
