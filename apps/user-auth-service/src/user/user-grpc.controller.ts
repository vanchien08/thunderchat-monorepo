import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { UserService } from './user.service'
import { BlockUserService } from './block-user.service'
import { IUserGrpcController } from './user.interface'
import { EGrpcServices } from '@/utils/enums'
import {
  CheckBlockedUserRequest,
  FindByIdRequest,
  FindUserWithProfileByIdRequest,
  GetUserByEmailRequest,
  findUsersForGlobalSearchRq,
} from 'protos/generated/user'

@Controller()
export class UserGrpcController implements IUserGrpcController {
  constructor(
    private readonly userService: UserService,
    private readonly blockUserService: BlockUserService
  ) {}

  @GrpcMethod(EGrpcServices.USER_SERVICE, 'FindUserWithProfileById')
  async FindUserWithProfileById(data: FindUserWithProfileByIdRequest) {
    const user = await this.userService.findUserWithProfileById(data.userId)
    return { userJson: JSON.stringify(user) }
  }

  @GrpcMethod(EGrpcServices.USER_SERVICE, 'GetUserByEmail')
  async GetUserByEmail(data: GetUserByEmailRequest) {
    const user = await this.userService.getUserByEmail(data.email)
    return { userJson: JSON.stringify(user) }
  }

  @GrpcMethod(EGrpcServices.USER_SERVICE, 'FindById')
  async FindById(data: FindByIdRequest) {
    const user = await this.userService.findById(data.id)
    return { userJson: JSON.stringify(user) }
  }

  @GrpcMethod(EGrpcServices.USER_SERVICE, 'findUsersForGlobalSearch')
  async findUsersForGlobalSearch(data: findUsersForGlobalSearchRq) {
    const users = await this.userService.findUsersForGlobalSearch(
      data.ids,
      data.selfUserId,
      data.limit
    )
    return { usersJson: users.map((user) => JSON.stringify(user)) }
  }

  @GrpcMethod(EGrpcServices.BLOCK_USER_SERVICE, 'CheckBlockedUser')
  async CheckBlockedUser(data: CheckBlockedUserRequest) {
    const blockedUser = await this.blockUserService.checkBlockedUser(data.blockerId, data.blockedId)
    return { blockedUserJson: JSON.stringify(blockedUser) }
  }
}
