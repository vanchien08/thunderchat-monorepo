export enum ECallStatus {
  REQUESTING = 'REQUESTING',
  RINGING = 'RINGING',
  ACCEPTED = 'ACCEPTED',
  CONNECTED = 'CONNECTED',
  ENDED = 'ENDED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

export enum EHangupReason {
  NORMAL = 'NORMAL',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ICE_FAILED = 'ICE_FAILED',
  PEER_LEFT = 'PEER_LEFT',
  UNKNOWN = 'UNKNOWN',
}

export enum ESDPType {
  OFFER = 'offer',
  ANSWER = 'answer',
  PRANSWER = 'pranswer',
  ROLLBACK = 'rollback',
}
