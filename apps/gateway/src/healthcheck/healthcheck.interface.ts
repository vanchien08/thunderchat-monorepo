import type { THealthcheckRes } from './healthcheck.type'

export interface IHealthcheck {
  healthcheck(): Promise<THealthcheckRes>
}
