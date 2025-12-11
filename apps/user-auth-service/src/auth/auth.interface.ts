import type { Response } from 'express'
import type {
  LoginUserDTO,
  AdminLoginDTO,
  CheckAuthDataDTO,
  CheckAdminEmailDTO,
  LogoutPayloadDTO,
} from './auth.dto'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TSuccess } from '@/utils/types'
import {
  CompareHashedPasswordRequest,
  CompareHashedPasswordResponse,
  CreateJWTRequest,
  CreateJWTResponse,
  GetHashedPasswordRequest,
  GetHashedPasswordResponse,
  VerifyTokenRequest,
} from 'protos/generated/auth'
import type {
  TValidateCallSocketAuthRes,
  TValidateCallSocketAuthPayload,
  TValidateSocketConnectionPayload,
  TValidateSocketAuthPayload,
  TValidateSocketAuthRes,
  TVerifyTokenRes,
  TGetJWTcookieOtpsRes,
  TLoginRes,
} from './auth.type'

export interface IAuthController {
  login: (loginUserPayload: LoginUserDTO) => Promise<TLoginRes>
  adminLogin: (adminLoginPayload: AdminLoginDTO) => Promise<TLoginRes>
  checkAdminEmail: (
    checkAdminEmailPayload: CheckAdminEmailDTO
  ) => Promise<{ isAdmin: boolean; message?: string }>
  logout: (user: TUserWithProfile, reqBody: LogoutPayloadDTO) => Promise<TSuccess>
  checkAuth: (user: TUserWithProfile) => Promise<CheckAuthDataDTO>
  checkAdminAuth: (user: TUserWithProfile) => Promise<CheckAuthDataDTO>
}

export interface IAuthGrpcController {
  ValidateSocketAuth: (data: TValidateSocketAuthPayload) => Promise<TValidateSocketAuthRes>
  ValidateSocketConnection: (data: TValidateSocketConnectionPayload) => Promise<void>
  ValidateCallSocketAuth: (
    data: TValidateCallSocketAuthPayload
  ) => Promise<TValidateCallSocketAuthRes>
  VerifyToken: (data: VerifyTokenRequest) => Promise<TVerifyTokenRes>
  CreateJWT: (data: CreateJWTRequest) => Promise<CreateJWTResponse>
  CompareHashedPassword: (
    data: CompareHashedPasswordRequest
  ) => Promise<CompareHashedPasswordResponse>
  GetHashedPassword: (data: GetHashedPasswordRequest) => Promise<GetHashedPasswordResponse>
}
