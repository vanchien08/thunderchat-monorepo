import { Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { JWTService } from './jwt/jwt.service'
import { CredentialService } from './credentials/credentials.service'
import type { TLoginUserParams, TLoginUserRes } from './auth.type'
import { EGrpcPackages, EGrpcServices, EProviderTokens } from '@/utils/enums'
import { EAuthMessages } from '@/auth/auth.message'
import { BaseWsException } from '@/utils/exceptions/base-ws.exception'
import { EValidationMessages } from '@/utils/messages'
import { ClientSocketAuthDTO, CallSocketAuthDTO } from './auth.dto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SystemException } from '@/utils/exceptions/system.exception'
import { EAppRoles } from '@/utils/enums'
import { EAdminMessages } from './role/admin/admin.message'
import { PrismaService } from '@/configs/db/prisma.service'
import { UserConnectionService } from '@/configs/communication/grpc/services/user-connection.service'
import type { TSocketId } from '@/connection/user-connection.type'
import { ClientGrpc } from '@nestjs/microservices'
import { Handshake } from 'socket.io/dist/socket-types'
import { UserService } from '@/user/user.service'

@Injectable()
export class AuthService {
  private userConnectionService: UserConnectionService

  constructor(
    private credentialService: CredentialService,
    private jwtService: JWTService,
    private userService: UserService,
    @Inject(EGrpcPackages.CHAT_PACKAGE) private userConnectionGrpcClient: ClientGrpc,
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService
  ) {
    this.userConnectionService = new UserConnectionService(
      this.userConnectionGrpcClient.getService(EGrpcServices.USER_CONNECTION_SERVICE)
    )
  }

  async preAll(): Promise<void> {
    // const users = await this.prisma.user.findMany()
    // for (const user of users) {
    //   await this.prisma.messageMapping.create({
    //     data: {
    //       userId: user.id,
    //       key: crypto.randomBytes(32).toString('hex'),
    //     },
    //   })
    // }
  }

  /**
   * Kiểm tra xem user có bị ban không
   * @param userId ID của user cần kiểm tra
   * @returns Thông tin về trạng thái ban của user
   */
  async checkUserBanStatus(userId: number): Promise<{
    isBanned: boolean
    banType?: 'TEMPORARY_BAN' | 'PERMANENT_BAN'
    banReason?: string
    bannedUntil?: Date
    message?: string
  }> {
    try {
      // Tìm violation action mới nhất của user (bị báo cáo)
      const latestViolationAction = await this.prisma.violationAction.findFirst({
        where: {
          Report: {
            reportedUserId: userId,
          },
          actionType: {
            in: ['TEMPORARY_BAN', 'PERMANENT_BAN'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          Report: true,
        },
      })

      if (!latestViolationAction) {
        return { isBanned: false }
      }

      const now = new Date()
      const banType = latestViolationAction.actionType
      const banReason = latestViolationAction.actionReason
      const bannedUntil = latestViolationAction.bannedUntil

      // Kiểm tra permanent ban
      if (banType === 'PERMANENT_BAN') {
        return {
          isBanned: true,
          banType: 'PERMANENT_BAN',
          banReason,
          message: `Tài khoản của bạn đã bị cấm vĩnh viễn. Lý do: ${banReason}`,
        }
      }

      // Kiểm tra temporary ban
      if (banType === 'TEMPORARY_BAN' && bannedUntil) {
        if (now < bannedUntil) {
          // Vẫn còn trong thời gian ban – tính chính xác ngày, giờ, phút
          const remainingMs = Math.max(0, bannedUntil.getTime() - now.getTime())
          const dayMs = 24 * 60 * 60 * 1000
          const hourMs = 60 * 60 * 1000
          const minuteMs = 60 * 1000

          const days = Math.floor(remainingMs / dayMs)
          const hours = Math.floor((remainingMs % dayMs) / hourMs)
          const minutes = Math.floor((remainingMs % hourMs) / minuteMs)

          const parts: string[] = []
          if (days > 0) parts.push(`${days} ngày`)
          if (hours > 0) parts.push(`${hours} giờ`)
          // Hiển thị phút ngay cả khi 0 nếu không có phần nào khác
          if (minutes > 0 || parts.length === 0) parts.push(`${minutes} phút`)
          const remainingText = parts.join(' ')

          return {
            isBanned: true,
            banType: 'TEMPORARY_BAN',
            banReason,
            bannedUntil,
            message: `Tài khoản của bạn đã bị cấm tạm thời. Lý do: ${banReason}. Thời gian cấm còn lại: ${remainingText}`,
          }
        } else {
          // Hết thời gian ban
          return { isBanned: false }
        }
      }

      return { isBanned: false }
    } catch (error) {
      console.error('Error checking user ban status:', error)
      return { isBanned: false }
    }
  }

  async loginUser({ email, password }: TLoginUserParams): Promise<TLoginUserRes> {
    const user = await this.userService.getUserByEmail(email)

    const isMatch = await this.credentialService.compareHashedPassword(password, user.password)
    if (!isMatch) {
      throw new UnauthorizedException(EAuthMessages.INCORRECT_EMAIL_PASSWORD)
    }

    // Kiểm tra trạng thái ban của user
    const banStatus = await this.checkUserBanStatus(user.id)
    if (banStatus.isBanned) {
      throw new UnauthorizedException(banStatus.message || 'Tài khoản của bạn đã bị cấm')
    }

    const { jwt_token } = await this.jwtService.createJWT({
      email: user.email,
      user_id: user.id,
    })

    return {
      jwt_token,
    }
  }

  async loginAdmin({ email, password }: TLoginUserParams): Promise<TLoginUserRes> {
    const user = await this.userService.getUserByEmail(email)

    // Kiểm tra password
    const isMatch = await this.credentialService.compareHashedPassword(password, user.password)
    if (!isMatch) {
      throw new UnauthorizedException(EAuthMessages.INCORRECT_EMAIL_PASSWORD)
    }

    // Kiểm tra role ADMIN
    if (user.role !== EAppRoles.ADMIN) {
      throw new UnauthorizedException(EAdminMessages.INVALID_ADMIN_CREDENTIALS)
    }

    // Kiểm tra trạng thái ban của admin (admin cũng có thể bị ban)
    const banStatus = await this.checkUserBanStatus(user.id)
    if (banStatus.isBanned) {
      throw new UnauthorizedException(banStatus.message || 'Tài khoản admin của bạn đã bị cấm')
    }

    const { jwt_token } = await this.jwtService.createJWT({
      email: user.email,
      user_id: user.id,
    })

    return {
      jwt_token,
    }
  }

  async checkAdminEmail(email: string): Promise<{ isAdmin: boolean; message?: string }> {
    try {
      const user = await this.userService.getUserByEmail(email)

      // Kiểm tra role ADMIN
      if (user.role === EAppRoles.ADMIN) {
        return { isAdmin: true }
      } else {
        return {
          isAdmin: false,
          message: EAdminMessages.ADMIN_ACCESS_REQUIRED,
        }
      }
    } catch (error) {
      // Nếu user không tồn tại hoặc có lỗi khác
      return {
        isAdmin: false,
        message: EAdminMessages.ADMIN_NOT_FOUND,
      }
    }
  }

  async logoutUser(userId: number, socketId?: TSocketId): Promise<void> {
    this.userConnectionService.removeConnectedClient(userId, socketId)
  }

  async adminLogout(userId: number): Promise<void> {
    const user = await this.userService.findById(userId)
    if (!user || user.role !== EAppRoles.ADMIN) {
      throw new UnauthorizedException(EAdminMessages.ADMIN_ACCESS_REQUIRED)
    }
    this.userConnectionService.removeConnectedClient(userId)
  }

  async validateSocketConnection(handshakeAuth: Handshake['auth']): Promise<void> {
    const jwt = handshakeAuth.authToken
    if (!jwt) {
      throw new SystemException(EAuthMessages.INVALID_CREDENTIALS)
    }
    try {
      await this.jwtService.verifyToken(jwt)
    } catch (error) {
      throw new SystemException(EAuthMessages.AUTHENTICATION_FAILED)
    }
  }

  async validateSocketAuth(handshakeAuth: Handshake['auth']): Promise<ClientSocketAuthDTO> {
    const socketAuth = plainToInstance(ClientSocketAuthDTO, handshakeAuth)
    const errors = await validate(socketAuth)
    if (errors && errors.length > 0) {
      throw new BaseWsException(EValidationMessages.INVALID_INPUT)
    }
    return socketAuth
  }

  async validateCallSocketAuth(handshakeAuth: Handshake['auth']): Promise<CallSocketAuthDTO> {
    const socketAuth = plainToInstance(CallSocketAuthDTO, handshakeAuth)
    const errors = await validate(socketAuth)
    if (errors && errors.length > 0) {
      throw new BaseWsException(EValidationMessages.INVALID_INPUT)
    }
    return socketAuth
  }
}
