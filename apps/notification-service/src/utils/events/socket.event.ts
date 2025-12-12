import type {
  TGetDirectMessagesMessage,
  TMsgStatusPayload,
} from '@/message/message.type';
import type { TUserWithProfile } from '../entities/user.entity';
import type {
  TFriendRequestPayload,
  TGetFriendRequestsData,
} from '@/friend-request/friend-request.type';
import type { TWsErrorResponse } from '../types';
import type { TDirectChat } from '../entities/direct-chat.entity';
import type { EChatType, EUserOnlineStatus } from '../enums';
import type { TGroupChat } from '../entities/group-chat.entity';
import type { TMessage, TMessageFullInfo } from '../entities/message.entity';
import type { TUserId } from '@/user/user.type';

import type { TPinMessageGroupEmitPayload } from './event.type';
import { UpdateProfileDto } from '@/profile/profile.dto';
import { EHangupReason, ESDPType, EVoiceCallStatus } from '@/voice-call/voice-call.enum';
import { TActiveVoiceCallSession } from '@/voice-call/voice-call.type';

export enum EMessagingListenSocketEvents {
  client_hello = 'client_hello',
  send_message_direct = 'send_message:direct',
  send_message_group = 'send_message:group',
  join_group_chat_room = 'join_group_chat_room',
  message_seen_direct = 'message_seen:direct',
  typing_direct = 'typing:direct',
  check_user_online_status = 'check_user_online_status',
  join_direct_chat_room = 'join_direct_chat_room',
}

export enum EMessagingEmitSocketEvents {
  server_hello = 'server_hello',
  send_message_direct = 'send_message:direct',
  send_friend_request = 'friend_request:send',
  error = 'error',
  recovered_connection = 'recovered_connection',
  message_seen_direct = 'message_seen:direct',
  typing_direct = 'typing:direct',
  friend_request_action = 'friend_request_action',
  pin_message = 'pin_message',
  new_conversation = 'new_conversation',
  broadcast_user_online_status = 'broadcast_user_online_status',
  remove_group_chat_members = 'remove_group_chat_members',
  add_group_chat_members = 'add_group_chat_members',
  send_message_group = 'send_message:group',
  update_group_chat_info = 'update_group_chat_info',
  update_user_info = 'update_user_info',
  delete_direct_chat = 'delete_direct_chat',
  delete_group_chat = 'delete_group_chat',
  member_leave_group_chat = 'member_leave_group_chat',
  pin_message_group = 'pin_message:group',
}

export interface IMessagingEmitSocketEvents {
  [EMessagingEmitSocketEvents.server_hello]: (payload: string) => void;
  [EMessagingEmitSocketEvents.send_message_direct]: (
    payload: TGetDirectMessagesMessage,
  ) => void;
  [EMessagingEmitSocketEvents.send_friend_request]: (
    payload: TUserWithProfile,
    requestData: TGetFriendRequestsData,
  ) => void;
  [EMessagingEmitSocketEvents.error]: (error: TWsErrorResponse) => void;
  [EMessagingEmitSocketEvents.recovered_connection]: (
    messages: TGetDirectMessagesMessage[],
  ) => void;
  [EMessagingEmitSocketEvents.message_seen_direct]: (
    payload: TMsgStatusPayload,
  ) => void;
  [EMessagingEmitSocketEvents.typing_direct]: (
    isTyping: boolean,
    directChatId: number,
  ) => void;
  [EMessagingEmitSocketEvents.friend_request_action]: (
    payload: TFriendRequestPayload,
  ) => void;
  [EMessagingEmitSocketEvents.pin_message]: (payload: any) => void;
  [EMessagingEmitSocketEvents.new_conversation]: (
    directChat: TDirectChat | null,
    groupChat: TGroupChat | null,
    type: EChatType,
    newMessage: TMessage | null,
    sender: TUserWithProfile,
  ) => void;
  [EMessagingEmitSocketEvents.broadcast_user_online_status]: (
    userId: TUserId,
    onlineStatus: EUserOnlineStatus,
  ) => void;
  [EMessagingEmitSocketEvents.remove_group_chat_members]: (
    memberIds: number[],
    groupChat: TGroupChat,
  ) => void;
  [EMessagingEmitSocketEvents.add_group_chat_members]: (
    newMemberIds: number[],
    groupChat: TGroupChat,
  ) => void;
  [EMessagingEmitSocketEvents.send_message_group]: (
    newMessage: TMessageFullInfo,
  ) => void;
  [EMessagingEmitSocketEvents.update_group_chat_info]: (
    groupChatId: number,
    groupChat: Partial<TGroupChat>,
  ) => void;
  [EMessagingEmitSocketEvents.update_user_info]: (
    directChatId: number,
    updatedUserId: TUserId,
    updates: UpdateProfileDto,
  ) => void;
  [EMessagingEmitSocketEvents.delete_direct_chat]: (
    directChatId: number,
    deleter: TUserWithProfile,
  ) => void;
  [EMessagingEmitSocketEvents.delete_group_chat]: (groupChatId: number) => void;
  [EMessagingEmitSocketEvents.member_leave_group_chat]: (
    groupChatId: number,
    userId: number,
  ) => void;
  [EMessagingEmitSocketEvents.pin_message_group]: (
    payload: TPinMessageGroupEmitPayload,
  ) => void;
}

export enum EVoiceCallListenSocketEvents {
  client_hello = 'client_hello',
  call_request = 'voice_call:request',
  call_accept = 'voice_call:accept',
  call_reject = 'voice_call:reject',
  call_offer_answer = 'voice_call:offer_answer',
  call_ice = 'voice_call:ice',
  call_hangup = 'voice_call:hangup',
}

export enum EVoiceCallEmitSocketEvents {
  server_hello = 'server_hello',
  call_request = 'voice_call:request',
  call_ice = 'voice_call:ice',
  call_status = 'voice_call:status',
  call_offer_answer = 'voice_call:offer_answer',
  call_hangup = 'voice_call:hangup',
  call_timeout = 'voice_call:timeout',
}

export interface IVoiceCallEmitSocketEvents {
  [EVoiceCallEmitSocketEvents.server_hello]: (payload: string) => void
  [EVoiceCallEmitSocketEvents.call_request]: (activeCallSession: TActiveVoiceCallSession) => void
  [EVoiceCallEmitSocketEvents.call_status]: (
    status: EVoiceCallStatus,
    activeCallSession?: TActiveVoiceCallSession
  ) => void
  [EVoiceCallEmitSocketEvents.call_offer_answer]: (SDP: string, type: ESDPType) => void
  [EVoiceCallEmitSocketEvents.call_ice]: (
    candidate: string,
    sdpMid?: string,
    sdpMLineIndex?: number
  ) => void
  [EVoiceCallEmitSocketEvents.call_hangup]: (reason?: EHangupReason) => void
  [EVoiceCallEmitSocketEvents.call_timeout]: () => void
}