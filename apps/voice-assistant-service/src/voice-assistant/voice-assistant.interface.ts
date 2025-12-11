export interface PendingAction {
  type:
    | 'send_message'
    | 'send_voice_message'
    | 'send_sticker'
    | 'create_group'
    | 'join_group'
    | 'invite_to_group'
    | 'make_call'
    | 'incoming_call'
    | 'change_user_name'
    | 'search_message'
    | 'search_smart'
    | 'send_image'
    | 'send_document'
    | 'send_file';
  targetId: number;
  targetName: string;
  content: string;
  lastBotMessage: string;
  audioBase64?: string; // For voice messages
  stickerId?: number; // For send_sticker
  stickerDescription?: string; // For send_sticker
  groupName?: string; // For create_group
  memberIds?: number[]; // For create_group
  memberNames?: string[]; // For create_group
  chatType?: 'direct' | 'group';
}

export interface LlmResult {
  function:
    | 'check_new_messages'
    | 'read_latest_messages'
    | 'read_missed_calls'
    | 'send_message'
    | 'send_voice_message'
    | 'send_image'
    | 'send_document'
    | 'send_file'
    | 'send_sticker'
    | 'create_group'
    | 'invite_to_group'
    | 'join_group'
    | 'make_call'
    | 'open_chat'
    | 'change_user_name'
    | 'search_message'
    | 'search_smart'
    | 'confirm_action'
    | 'cancel_action'
    | 'clarify';
  parameters?: Record<string, any>;
  response: string;
}

export interface ExecutionResult {
  response: string;
  pending?: PendingAction;
  clientAction?: {
    type:
      | 'create_group'
      | 'join_group'
      | 'invite_to_group'
      | 'send_message'
      | 'send_voice_message'
      | 'send_sticker'
      | 'send_image'
      | 'send_document'
      | 'send_file'
      | 'make_call'
      | 'search_smart';
    payload: Record<string, any>;
  };
}
