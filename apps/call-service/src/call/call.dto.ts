import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  IsBoolean,
  ValidateNested,
} from 'class-validator'
import { EHangupReason, ESDPType, ECallStatus } from './call.enum'
import { Type } from 'class-transformer'
import type { TCallSessionActiveId } from './call.type'

export class CallRequestDTO {
  @IsNotEmpty() @IsString() sessionId: TCallSessionActiveId
  @IsNumber() @Type(() => Number) directChatId: number
  @IsNumber() @Type(() => Number) calleeUserId: number
  @IsBoolean()
  @IsOptional()
  isVideoCall?: boolean
}

export class CallSessionPayloadDTO {
  @IsNotEmpty() @IsString() id: TCallSessionActiveId
  @IsNumber() @Type(() => Number) callerUserId: number
  @IsNumber() @Type(() => Number) calleeUserId: number
  @IsNumber() @Type(() => Number) directChatId: number
  @IsBoolean() isVideoCall: boolean
  @IsEnum(ECallStatus) status: ECallStatus
  @IsBoolean()
  @IsOptional()
  isGroupCall?: boolean
}

export class CallAcceptDTO {
  @ValidateNested()
  @Type(() => CallSessionPayloadDTO)
  session: CallSessionPayloadDTO
}

export class CallRejectDTO {
  @ValidateNested()
  @Type(() => CallSessionPayloadDTO)
  session: CallSessionPayloadDTO
  @IsOptional() @IsString() reason?: string
}

export class CallHangupDTO {
  @ValidateNested()
  @Type(() => CallSessionPayloadDTO)
  session: CallSessionPayloadDTO
  @IsOptional() @IsEnum(EHangupReason) reason?: EHangupReason
}

export class SDPOfferAnswerDTO {
  @IsNotEmpty() @IsString() sessionId: TCallSessionActiveId
  @IsString() SDP: string
  @IsString() type: ESDPType
}

export class IceCandidateDTO {
  @IsNotEmpty() @IsString() sessionId: TCallSessionActiveId
  @IsString() candidate: string
  @IsOptional() @IsString() sdpMid?: string
  @IsOptional() @IsNumber() sdpMLineIndex?: number
}

export class CalleeSetSessionDTO {
  @IsNotEmpty() @IsString() sessionId: TCallSessionActiveId
}
