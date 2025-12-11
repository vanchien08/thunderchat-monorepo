import type { NextFunction } from 'express'
import type { Socket } from 'socket.io'
import type { TGroupChat } from '@/utils/entities/group-chat.entity'

export type TServerMiddleware = (socket: Socket, next: NextFunction) => void

export type TCreateGroupChatRoomNameHandler = (groupChatId: TGroupChat['id']) => string

export type TSocketId = Socket['id']
