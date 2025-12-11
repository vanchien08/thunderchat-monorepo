import { plainToInstance } from 'class-transformer'
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator'
import { EEnvironments } from '../enums'

class EnvironmentVariables {
  @IsEnum(EEnvironments)
  NODE_ENV: EEnvironments

  @IsNumber()
  PORT: number

  @IsNumber()
  GRPC_PORT: number

  @IsString()
  DATABASE_URL: string
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
