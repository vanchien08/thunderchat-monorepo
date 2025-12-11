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

export interface IAuthController {
  login: (loginUserPayload: LoginUserDTO, res: Response) => Promise<TSuccess>
  adminLogin: (adminLoginPayload: AdminLoginDTO, res: Response) => Promise<TSuccess>
  checkAdminEmail: (
    checkAdminEmailPayload: CheckAdminEmailDTO
  ) => Promise<{ isAdmin: boolean; message?: string }>
  logout: (res: Response, user: TUserWithProfile, reqBody: LogoutPayloadDTO) => Promise<TSuccess>
  checkAuth: (user: TUserWithProfile) => Promise<CheckAuthDataDTO>
  checkAdminAuth: (user: TUserWithProfile) => Promise<CheckAuthDataDTO>
}
