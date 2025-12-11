import { Type } from 'class-transformer'
import { IsArray, IsNumber } from 'class-validator'

export class FetchGroupChatMembersDTO {
  @IsNumber()
  @Type(() => Number)
  groupChatId: number

  @IsArray()
  @IsNumber({}, { each: true })
  memberIds: number[]
}

export class RemoveGroupChatMemberDTO {
  @IsNumber()
  @Type(() => Number)
  groupChatId: number

  @IsNumber()
  @Type(() => Number)
  memberId: number
}

export class AddMembersToGroupChatDTO {
  @IsNumber()
  @Type(() => Number)
  groupChatId: number

  @IsArray()
  @IsNumber({}, { each: true })
  memberIds: number[]
}

export class LeaveGroupChatDTO {
  @IsNumber()
  @Type(() => Number)
  groupChatId: number
}
