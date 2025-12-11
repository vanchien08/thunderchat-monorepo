import { ValidationError, ValidationPipe } from '@nestjs/common';
import { BaseWsException } from '../exceptions/base-ws.exception';
import { EValidationMessages } from '@/utils/messages';
import { DevLogger } from '@/dev/dev-logger';

export const gatewayValidationPipe = new ValidationPipe({
  transform: true,
  exceptionFactory: (errors: ValidationError[]) => {
    DevLogger.logError('DTO validation errors:', errors);
    return new BaseWsException(EValidationMessages.INVALID_INPUT);
  },
});
