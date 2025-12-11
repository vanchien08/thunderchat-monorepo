import { UnknownException } from '@/utils/exceptions/system.exception'
import { Injectable } from '@nestjs/common'

@Injectable()
export class LoggerService {
  log(message: string): void {}

  error(error: UnknownException): void {}

  warn(message: string): void {}
}
