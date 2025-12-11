import { UnauthorizedException } from '@nestjs/common'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { EAppRoles } from '@/utils/enums'
import { EAdminMessages } from './admin.message'

/**
 * Kiểm tra user có role ADMIN không
 * @param user - User object từ request
 * @throws UnauthorizedException nếu không phải admin
 */
export function checkAdminRole(user: TUserWithProfile): void {
  if (!user) {
    throw new UnauthorizedException(EAdminMessages.USER_NOT_AUTHENTICATED)
  }

  if (user.role !== EAppRoles.ADMIN) {
    throw new UnauthorizedException(EAdminMessages.ADMIN_ACCESS_REQUIRED)
  }
}

/**
 * Kiểm tra user có role ADMIN không (không throw exception)
 * @param user - User object từ request
 * @returns true nếu là admin, false nếu không
 */
export function isAdminRole(user: TUserWithProfile): boolean {
  return user?.role === EAppRoles.ADMIN
}

/**
 * Kiểm tra user có thể thực hiện admin action không
 * @param user - User object từ request
 * @param action - Tên action đang thực hiện
 * @throws UnauthorizedException nếu không có quyền
 */
export function validateAdminAction(user: TUserWithProfile, action: string): void {
  checkAdminRole(user)

  // Log admin action
  console.log(`[ADMIN_ACTION] User ${user.id} (${user.email}) performed: ${action}`)
}

/**
 * Kiểm tra user có thể quản lý user khác không
 * @param adminUser - Admin user
 * @param targetUserId - ID của user bị quản lý
 * @throws UnauthorizedException nếu không có quyền
 */
export function validateUserManagement(adminUser: TUserWithProfile, targetUserId: number): void {
  checkAdminRole(adminUser)

  // Không cho phép admin quản lý chính mình
  if (adminUser.id === targetUserId) {
    throw new UnauthorizedException('Cannot manage your own account')
  }

  console.log(`[USER_MANAGEMENT] Admin ${adminUser.id} managing user ${targetUserId}`)
}
