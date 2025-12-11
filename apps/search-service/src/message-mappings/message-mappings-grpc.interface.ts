import type {
  CreateMessageMappingsRequest,
  CreateMessageMappingsResponse,
  GetMessageMappingsResponse,
  UpdateMessageMappingsRequest,
  UpdateMessageMappingsResponse,
} from 'protos/generated/search'

export interface IMessageMappingsGrpcController {
  createMessageMappings(
    payload: CreateMessageMappingsRequest
  ): Promise<CreateMessageMappingsResponse>
  getMessageMappings(): Promise<GetMessageMappingsResponse>
  updateMessageMappings(
    payload: UpdateMessageMappingsRequest
  ): Promise<UpdateMessageMappingsResponse>
}
