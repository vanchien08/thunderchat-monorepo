import { SetMetadata } from '@nestjs/common'

export const GROUP_CHAT_ROLE_KEY = 'role'
export const GroupChatRoles = (...role: string[]) => SetMetadata(GROUP_CHAT_ROLE_KEY, role)
