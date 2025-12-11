import { Injectable } from '@nestjs/common'
import crypto from 'crypto'

@Injectable()
export class FileService {
  constructor() {}

  static hashFileName(fileName: string, fileNameLength: number = 16) {
    return crypto.createHash('sha256').update(fileName).digest('hex').slice(0, fileNameLength)
  }
}
