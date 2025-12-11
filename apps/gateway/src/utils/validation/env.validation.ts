import { plainToInstance } from 'class-transformer'
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator'
import { EEnvironments } from '../enums'

class EnvironmentVariables {
  @IsEnum(EEnvironments)
  NODE_ENV: EEnvironments

  @IsNumber()
  PORT: number

  @IsString()
  DATABASE_URL: string

  @IsString()
  SESSION_SECRET: string

  @IsString()
  SESSION_NAME: string

  @IsString()
  COOKIE_EXPIRE_IN_HOURS: string

  @IsString()
  CLIENT_HOST_DEV: string

  @IsString()
  JWT_SECRET: string

  @IsString()
  JWT_TOKEN_MAX_AGE_IN_HOUR: string

  @IsString()
  CLIENT_DOMAIN_DEV: string

  @IsString()
  ELASTICSEARCH_URL: string

  @IsString()
  ELASTIC_API_KEY: string

  @IsString()
  DECRYPT_USER_KEY_MASTER_KEY: string

  @IsString()
  VAPID_PUBLIC_KEY: string

  @IsString()
  VAPID_PRIVATE_KEY: string

  @IsString()
  VAPID_MAILTO: string
  SMTP_HOST: string

  @IsString()
  SMTP_PORT: string

  @IsString()
  SMTP_SECURE: string

  @IsString()
  SMTP_USER: string

  @IsString()
  SMTP_PASS: string

  @IsString()
  MAIL_FROM: string
}

export function envValidation(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validatedConfig, { skipMissingProperties: false })
  if (errors.length > 0) {
    throw new Error(errors.toString())
  }
  return validatedConfig
}
