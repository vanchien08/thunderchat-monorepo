import type { TFindUserSettingsByUserIdGrpcRes } from './user-settings.type'
import type { FindByUserIdRequest } from 'protos/generated/user'

export interface IUserSettings {
  id: number
  userId: number
  onlyReceiveFriendMessage: boolean
}
export interface IUserSettingsGrpcController {
  FindByUserId(data: FindByUserIdRequest): Promise<TFindUserSettingsByUserIdGrpcRes>
}
