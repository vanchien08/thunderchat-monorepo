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
