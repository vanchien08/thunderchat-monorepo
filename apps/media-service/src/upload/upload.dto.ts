import { IsString } from 'class-validator'

export class GetFileDTO {
  @IsString()
  fkey: string
}
