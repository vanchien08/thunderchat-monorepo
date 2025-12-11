import type { TBlockedUserFullInfo, TUserWithProfile } from '@/utils/entities/user.entity'
import type {
  TCheckBlockedUserGrpcRes,
  TFindByIdGrpcRes,
  TFindUserWithProfileByIdGrpcRes,
  TFindUsersForGlobalSearchGrpcRes,
  TGetUserByEmailGrpcRes,
  TRegisterRes,
  TSearchUsersData,
} from './user.type'
import type { TSuccess } from '@/utils/types'
import type {
  BlockUserDTO,
  ChangePasswordDTO,
  CheckBlockedUserDTO,
  CreateUserDTO,
  GetUserByEmailDTO,
  GetUserByIdDTO,
  SearchUsersDTO,
  UnblockUserDTO,
} from './user.dto'
import {
  CheckBlockedUserRequest,
  FindByIdRequest,
  FindUserWithProfileByIdRequest,
  GetUserByEmailRequest,
  findUsersForGlobalSearchRq,
} from 'protos/generated/user'

export interface IUserController {
  register: (createUserPayload: CreateUserDTO) => Promise<TRegisterRes>
  getUser: (getUserByEmailPayload: GetUserByEmailDTO) => Promise<TUserWithProfile>
  getUserById: (getUserById: GetUserByIdDTO) => Promise<TUserWithProfile>
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

export interface IUserGrpcController {
  FindUserWithProfileById: (
    data: FindUserWithProfileByIdRequest
  ) => Promise<TFindUserWithProfileByIdGrpcRes>
  GetUserByEmail: (data: GetUserByEmailRequest) => Promise<TGetUserByEmailGrpcRes>
  FindById: (data: FindByIdRequest) => Promise<TFindByIdGrpcRes>
  findUsersForGlobalSearch: (
    data: findUsersForGlobalSearchRq
  ) => Promise<TFindUsersForGlobalSearchGrpcRes>
  CheckBlockedUser: (data: CheckBlockedUserRequest) => Promise<TCheckBlockedUserGrpcRes>
}
