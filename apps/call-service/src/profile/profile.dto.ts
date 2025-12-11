import { IsOptional, IsString, IsDateString } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string

  @IsOptional()
  @IsDateString()
  birthday?: string

  @IsOptional()
  @IsString()
  about?: string

  @IsOptional()
  @IsString()
  avatar?: string // URL ảnh avatar
}
