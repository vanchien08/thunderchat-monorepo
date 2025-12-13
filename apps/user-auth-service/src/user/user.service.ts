import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  BadRequestException,
  forwardRef,
} from '@nestjs/common'
import type { TCreateUserParams, TSearchUsersData, TSearchProfilesData } from './user.type'
import { PrismaService } from '../configs/db/prisma.service'
import { EProviderTokens, ESyncDataToESWorkerType } from '@/utils/enums'
import { JWTService } from '@/auth/jwt/jwt.service'
import { CredentialService } from '@/auth/credentials/credentials.service'
import { EAuthMessages } from '@/auth/auth.message'
import { TUser, TUserWithProfile } from '@/utils/entities/user.entity'
import { TJWTToken, TSignatureObject } from '@/utils/types'
import { SearchUsersDTO } from './user.dto'
import { EUserMessages } from '@/user/user.message'
import { checkIsEmail } from '@/utils/helpers'
import * as crypto from 'crypto'
import * as bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'

@Injectable()
export class UserService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService,
    private jwtService: JWTService,
    private credentialService: CredentialService
  ) {}

  // In-memory store for OTP/reset-token
  private static inMemoryKeyValueStore: Map<string, string> = new Map()
  private static inMemoryHashStore: Map<string, Map<string, string>> = new Map()
  private static inMemoryExpiryTimers: Map<string, NodeJS.Timeout> = new Map()

  private clearExistingTimer(key: string) {
    const timer = UserService.inMemoryExpiryTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      UserService.inMemoryExpiryTimers.delete(key)
    }
  }

  private async storeSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    UserService.inMemoryKeyValueStore.set(key, value)
    this.clearExistingTimer(key)
    const timeout = setTimeout(() => {
      UserService.inMemoryKeyValueStore.delete(key)
      UserService.inMemoryExpiryTimers.delete(key)
    }, ttlSeconds * 1000)
    UserService.inMemoryExpiryTimers.set(key, timeout)
  }

  private async storeGet(key: string): Promise<string | null> {
    return UserService.inMemoryKeyValueStore.has(key)
      ? (UserService.inMemoryKeyValueStore.get(key) as string)
      : null
  }

  private async storeDel(key: string): Promise<void> {
    UserService.inMemoryKeyValueStore.delete(key)
    UserService.inMemoryHashStore.delete(key)
    this.clearExistingTimer(key)
  }

  private async storeHGetAll(key: string): Promise<Record<string, string>> {
    const bucket = UserService.inMemoryHashStore.get(key)
    if (!bucket) return {}
    const obj: Record<string, string> = {}
    for (const [k, v] of bucket.entries()) obj[k] = v
    return obj
  }

  private async storeHSet(key: string, entries: Record<string, string | number>): Promise<void> {
    let bucket = UserService.inMemoryHashStore.get(key)
    if (!bucket) {
      bucket = new Map<string, string>()
      UserService.inMemoryHashStore.set(key, bucket)
    }
    for (const [k, v] of Object.entries(entries)) {
      bucket.set(k, String(v))
    }
  }

  private async storeHIncrBy(key: string, field: string, increment: number): Promise<number> {
    let bucket = UserService.inMemoryHashStore.get(key)
    if (!bucket) {
      bucket = new Map<string, string>()
      UserService.inMemoryHashStore.set(key, bucket)
    }
    const current = Number(bucket.get(field) ?? 0)
    const next = current + increment
    bucket.set(field, String(next))
    return next
  }

  private async storeExpire(key: string, ttlSeconds: number): Promise<void> {
    this.clearExistingTimer(key)
    const timeout = setTimeout(() => {
      UserService.inMemoryHashStore.delete(key)
      UserService.inMemoryKeyValueStore.delete(key)
      UserService.inMemoryExpiryTimers.delete(key)
    }, ttlSeconds * 1000)
    UserService.inMemoryExpiryTimers.set(key, timeout)
  }

  private otpKey(email: string) {
    return `pwd_otp:${email}`
  }

  private tokenKey(email: string) {
    return `pwd_reset_token:${email}`
  }

  private getOtpTTLms() {
    return 10 * 60 * 1000
  }

  private getResetTokenTTLms() {
    return 15 * 60 * 1000
  }

  private getMailerTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  private async sendOtpEmail(email: string, otp: string) {
    const from = process.env.MAIL_FROM || 'no-reply@example.com'
    const transporter = this.getMailerTransport()
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_OTP === 'true') {
      console.log(`[OTP] email=${email} otp=${otp}`)
    }
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your ThunderChat password reset OTP',
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
      html: `<p>Your OTP is <b>${otp}</b>. It will expire in 10 minutes.</p>`,
    })
  }

  async requestPasswordReset(email: string) {
    const user = await this.PrismaService.user.findUnique({ where: { email } })
    const now = Date.now()
    if (!user) return

    // cooldown check
    const otpKey = this.otpKey(email)
    const existing = await this.storeHGetAll(otpKey)
    if (existing && existing.lastSentAt && now - Number(existing.lastSentAt) < 60 * 1000) {
      return
    }

    const otp = String(crypto.randomInt(100000, 999999))
    const otpHash = await bcrypt.hash(otp, await bcrypt.genSalt())
    await this.storeHSet(otpKey, {
      otpHash,
      expiresAt: now + this.getOtpTTLms(),
      attempts: 0,
      maxAttempts: 5,
      lastSentAt: now,
    })
    await this.storeExpire(otpKey, Math.ceil(this.getOtpTTLms() / 1000))
    await this.sendOtpEmail(email, otp)
  }

  async verifyPasswordResetOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const now = Date.now()
    const otpKey = this.otpKey(email)
    const record = await this.storeHGetAll(otpKey)
    if (!record || !record.otpHash)
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn')
    if (Number(record.expiresAt) < now) {
      await this.storeDel(otpKey)
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn')
    }
    if (Number(record.attempts) >= Number(record.maxAttempts)) {
      await this.storeDel(otpKey)
      throw new BadRequestException('Vượt quá số lần thử OTP')
    }
    const ok = await bcrypt.compare(otp, record.otpHash)
    if (!ok) {
      await this.storeHIncrBy(otpKey, 'attempts', 1)
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn')
    }
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenKey = this.tokenKey(email)
    await this.storeSetEx(tokenKey, Math.ceil(this.getResetTokenTTLms() / 1000), resetToken)
    await this.storeDel(otpKey)
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_OTP === 'true') {
      console.log(`[RESET_TOKEN] email=${email} resetToken=${resetToken}`)
    }
    return { resetToken }
  }

  async resetPasswordWithToken(resetToken: string, newPassword: string) {
    // find email by scanning token keys (we could store a reverse map, but keep simple)
    // In production, better to store email->token and token->email both.
    const emailCandidates = await this.PrismaService.user.findMany({
      select: { email: true },
    })
    let matchedEmail: string | null = null
    for (const { email } of emailCandidates) {
      const token = await this.storeGet(this.tokenKey(email))
      if (token === resetToken) {
        matchedEmail = email
        break
      }
    }
    if (!matchedEmail) throw new BadRequestException('Reset token không hợp lệ hoặc đã hết hạn')

    const user = await this.PrismaService.user.findUnique({
      where: { email: matchedEmail },
    })
    if (!user) {
      await this.storeDel(this.tokenKey(matchedEmail))
      throw new NotFoundException(EUserMessages.USER_NOT_FOUND)
    }
    const hashed = await this.credentialService.getHashedPassword(newPassword)
    await this.PrismaService.user.update({
      where: { id: user.id },
      data: { password: hashed },
    })
    await this.storeDel(this.tokenKey(matchedEmail))
  }

  async findById(id: number): Promise<TUser | null> {
    return await this.PrismaService.user.findUnique({
      where: { id },
    })
  }

  async findUserWithProfileById(userId: number): Promise<TUserWithProfile | null> {
    return await this.PrismaService.user.findUnique({
      where: { id: userId },
      include: {
        Profile: true,
      },
    })
  }

  async createUser({ email, password, fullName, birthday }: TCreateUserParams): Promise<TUser> {
    const hashedPassword = await this.credentialService.getHashedPassword(password)
    const existUser = await this.PrismaService.user.findUnique({
      where: { email },
    })
    if (existUser) {
      throw new ConflictException(EAuthMessages.USER_EXISTED)
    }
    const user = await this.PrismaService.user.create({
      data: {
        email: email,
        password: hashedPassword,
        Profile: {
          create: {
            fullName: fullName,
            birthday: birthday,
          },
        },
      },
      include: {
        Profile: true,
      },
    })
    // TODO: Implement ElasticSearch sync when search service is integrated
    // this.syncDataToESService.syncDataToES({
    //   type: ESyncDataToESWorkerType.CREATE_USER,
    //   user,
    // })
    return user
  }

  async registerUser(createUserData: TCreateUserParams): Promise<TJWTToken> {
    const user = await this.createUser(createUserData)
    return this.jwtService.createJWT({ email: user.email, user_id: user.id })
  }

  async getUserByEmail(email: string): Promise<TUserWithProfile> {
    const user = await this.PrismaService.user.findUnique({
      where: {
        email: email,
      },
      include: {
        Profile: true,
      },
    })
    if (!user) {
      throw new NotFoundException(EUserMessages.USER_NOT_FOUND)
    }

    return user
  }
  async getUserById(id: number): Promise<TUserWithProfile> {
    const user = await this.PrismaService.user.findUnique({
      where: {
        id: id,
      },
      include: {
        Profile: true,
      },
    })
    if (!user) {
      throw new NotFoundException(EUserMessages.USER_NOT_FOUND)
    }

    return user
  }
  mergeSimilarUsers(profles: TSearchProfilesData[]): TSearchUsersData[] {
    const users: TSearchUsersData[] = []
    for (const profile of profles) {
      const { User, ...profileInfo } = profile
      const user = { ...User, Profile: profileInfo }
      users.push(user)
    }
    return users
  }

  async searchUsers(searchUsersPayload: SearchUsersDTO): Promise<TSearchUsersData[]> {
    // Tìm kiếm các user dựa trên keyword
    const { keyword, lastUserId, limit } = searchUsersPayload
    if (checkIsEmail(keyword)) {
      const user = await this.PrismaService.user.findUnique({
        where: { email: keyword },
        include: {
          Profile: true,
        },
      })
      if (user) {
        return [user]
      }
    }
    let cursor: TSignatureObject = {}
    if (lastUserId) {
      cursor = {
        skip: 1,
        cursor: {
          id: lastUserId,
        },
      }
    }
    const profiles = await this.PrismaService.profile.findMany({
      take: limit,
      ...cursor,
      where: {
        OR: [{ fullName: { contains: keyword, mode: 'insensitive' } }],
      },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        User: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })
    const userFilter: number[] =
      profiles && profiles.length > 0 ? profiles.map((profile) => profile.User.id) : []
    const users = await this.PrismaService.user.findMany({
      take: limit,
      ...cursor,
      where: {
        id: { notIn: userFilter },
        email: { equals: keyword, mode: 'insensitive' },
      },
      select: {
        id: true,
        email: true,
        Profile: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
    })
    const searchResult = [...users, ...this.mergeSimilarUsers(profiles)]
    return searchResult
  }

  async findUsersForGlobalSearch(
    ids: number[],
    selfUserId: number,
    limit: number
  ): Promise<TUserWithProfile[]> {
    return await this.PrismaService.user.findMany({
      where: { id: { in: ids, not: selfUserId } },
      include: {
        Profile: true,
      },
      take: limit,
    })
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.findUserWithProfileById(userId)
    if (!user) throw new BadRequestException('User not found')

    // Kiểm tra mật khẩu cũ
    const isMatch = await this.credentialService.compareHashedPassword(oldPassword, user.password)
    if (!isMatch) throw new BadRequestException('Mật khẩu cũ không đúng')

    // Hash mật khẩu mới
    const hashed = await this.credentialService.getHashedPassword(newPassword)
    await this.PrismaService.user.update({
      where: { id: userId },
      data: { password: hashed },
    })
  }
}
