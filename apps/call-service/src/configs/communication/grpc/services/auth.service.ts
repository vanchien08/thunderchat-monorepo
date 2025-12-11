import type { CallSocketAuthDTO } from '@/auth/auth.dto'
import type { TCallClientSocket } from '@/utils/events/event.type'
import type { AuthService as AuthServiceType } from 'protos/generated/auth'
import { firstValueFrom } from 'rxjs'
import type { Socket } from 'socket.io'

export class AuthService {
  constructor(private instance: AuthServiceType) {}

  async validateSocketConnection(socket: Socket): Promise<void> {
    await firstValueFrom(
      this.instance.ValidateSocketConnection({
        handshakeAuthJson: JSON.stringify(socket.handshake.auth),
      })
    )
  }

  async validateCallSocketAuth(clientSocket: TCallClientSocket): Promise<CallSocketAuthDTO> {
    return JSON.parse(
      (
        await firstValueFrom(
          this.instance.ValidateCallSocketAuth({
            handshakeAuthJson: JSON.stringify(clientSocket.handshake.auth),
          })
        )
      ).callSocketAuthJson
    ) as CallSocketAuthDTO
  }
}
