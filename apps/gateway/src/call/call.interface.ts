import type {
  CallRejectDTO,
  IceCandidateDTO,
  SDPOfferAnswerDTO,
  CallAcceptDTO,
  CallHangupDTO,
  CallRequestDTO,
} from './call.dto'
import type { TCallRequestRes } from './call.type'
import type { TClientSocket } from '@/utils/events/event.type'

export interface ICallGateway {
  onCallRequest: (client: TClientSocket, payload: CallRequestDTO) => Promise<TCallRequestRes>
  onAccept: (payload: CallAcceptDTO) => Promise<void>
  onReject: (payload: CallRejectDTO) => Promise<void>
  onOfferAnswer: (client: TClientSocket, payload: SDPOfferAnswerDTO) => Promise<void>
  onIce: (client: TClientSocket, payload: IceCandidateDTO) => Promise<void>
  onHangup: (client: TClientSocket, payload: CallHangupDTO) => Promise<void>
}
