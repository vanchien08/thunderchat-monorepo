import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ADMIN_ONLY_KEY } from './admin.decorator'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { checkAdminRole } from './admin.utils'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.authorizeAdmin(context)
    return true
  }

  private async authorizeAdmin(context: ExecutionContext): Promise<void> {
    // Lấy metadata admin-only từ decorator
    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Nếu không có decorator @AdminOnly() thì không cần kiểm tra
    if (!isAdminOnly) return

    const request = context.switchToHttp().getRequest()
    const user = request['user'] as TUserWithProfile

    // Sử dụng utility function để kiểm tra role
    checkAdminRole(user)
  }
}
