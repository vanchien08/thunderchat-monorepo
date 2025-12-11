import { HttpStatus } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'

export class BaseWsException extends WsException {
   status: HttpStatus

   constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
      super(message)
      this.status = status
   }
}
