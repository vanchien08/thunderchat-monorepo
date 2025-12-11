import { ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../configs/db/prisma.service'
import { EMsgMessages } from './message.message'
import { EUserSettingsMessages } from '@/user/user-settings/user-settings.message'

export async function canSendDirectMessage(
  prisma: PrismaService,
  senderId: number,
  receiverId: number
): Promise<void> {
  // Kiểm tra đầu vào
  if (!Number.isInteger(senderId) || senderId <= 0) {
    throw new BadRequestException('senderId không hợp lệ')
  }
  if (!Number.isInteger(receiverId) || receiverId <= 0) {
    throw new BadRequestException('receiverId không hợp lệ')
  }
  // 1. Lấy settings của receiver
  const settings = await prisma.userSettings.findUnique({ where: { userId: receiverId } })
  // 2. Nếu receiver không bật chặn, cho phép gửi
  if (!settings?.onlyReceiveFriendMessage) return

  // 3. Nếu receiver bật chặn, kiểm tra có phải bạn bè không
  const isFriend = await prisma.friend.findFirst({
    where: {
      OR: [
        { senderId, recipientId: receiverId },
        { senderId: receiverId, recipientId: senderId },
      ],
    },
  })
  if (isFriend) return

  // 4. Nếu không phải bạn bè, throw exception
  throw new ForbiddenException(EUserSettingsMessages.ONLY_RECEIVE_FRIEND_MESSAGE)
}
