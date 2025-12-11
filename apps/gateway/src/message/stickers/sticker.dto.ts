import { Type } from 'class-transformer'
import { IsNumber, IsOptional } from 'class-validator'

export class GetStickersDTO {
  @IsNumber()
  @Type(() => Number)
  categoryId: number

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  offsetId?: number
}
