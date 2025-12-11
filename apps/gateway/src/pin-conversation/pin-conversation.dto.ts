import { Type } from 'class-transformer'
import { IsNumber, IsOptional } from 'class-validator'

export class TogglePinConversationPayloadDTO {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  groupChatId: number

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  directChatId: number
}
