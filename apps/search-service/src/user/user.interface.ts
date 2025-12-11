import type { TBlockedUserFullInfo, TUserWithProfile } from '@/utils/entities/user.entity'
import type { TSearchUsersData } from './user.type'
import type { TSuccess } from '@/utils/types'
import type {
  BlockUserDTO,
  ChangePasswordDTO,
  CheckBlockedUserDTO,
  CreateUserDTO,
  GetUserByEmailDTO,
  SearchUsersDTO,
  UnblockUserDTO,
} from './user.dto'
import type { Response } from 'express'

export interface IUserController {
  register: (createUserPayload: CreateUserDTO, res: Response) => Promise<TSuccess>
  getUser: (getUserByEmailPayload: GetUserByEmailDTO) => Promise<TUserWithProfile>
  searchUsers: (searchUsersPayload: SearchUsersDTO) => Promise<TSearchUsersData[]>
  changePassword: (
    user: TUserWithProfile,
    changePasswordPayload: ChangePasswordDTO
  ) => Promise<TSuccess>
  blockUser: (user: TUserWithProfile, blockUserPayload: BlockUserDTO) => Promise<TSuccess>
  checkBlockedUser: (
    user: TUserWithProfile,
    checkBlockedUserPayload: CheckBlockedUserDTO
  ) => Promise<TBlockedUserFullInfo | null>
  unblockUser: (user: TUserWithProfile, unblockUserPayload: UnblockUserDTO) => Promise<TSuccess>
  getBlockedUsersList: (user: TUserWithProfile) => Promise<TBlockedUserFullInfo[]>
}
