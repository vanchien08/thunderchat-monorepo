import { Injectable } from '@nestjs/common'
import type { THealthcheckRes } from './healthcheck.type'

@Injectable()
export class HealthcheckService {
  async healthcheck(): Promise<THealthcheckRes> {
    const randomNumber = Math.floor(Math.random() * 100) + 1
    return {
      message: `Healthcheck is OK! Random number: ${randomNumber}`,
    }
  }
}
