import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class CredentialService {
  async compareHashedPassword(password: string, encrypted: string): Promise<boolean> {
    return await bcrypt.compare(password, encrypted)
  }

  async getHashedPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, await bcrypt.genSalt())
  }
}
