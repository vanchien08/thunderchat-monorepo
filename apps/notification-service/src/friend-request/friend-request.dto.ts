import { Type } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator'
import type { TFriendRequestPayload } from './friend-request.type'
import { EFriendRequestStatus } from './friend-request.enum'

export class SendFriendRequestDTO {
   @IsNotEmpty()
   @IsNumber()
   @Type(() => Number)
   senderId: number

   @IsNotEmpty()
   @IsNumber()
   @Type(() => Number)
   recipientId: number
}

export class FriendRequestActionDTO implements TFriendRequestPayload {
   @IsNumber()
   @IsNotEmpty()
   @Type(() => Number)
   requestId: number

   @IsEnum(EFriendRequestStatus)
   @IsNotEmpty()
   action: EFriendRequestStatus

   @IsNotEmpty()
   @IsNumber()
   @Type(() => Number)
   senderId: number
}

export class GetFriendRequestsDTO {
   @IsNotEmpty()
   @IsNumber()
   @Type(() => Number)
   userId: number

   @IsNotEmpty()
   @IsNumber()
   @Type(() => Number)
   limit: number

   @IsOptional()
   @IsNumber()
   @Type(() => Number)
   lastFriendRequestId?: number
}
