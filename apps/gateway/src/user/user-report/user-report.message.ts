export enum EUserReportMessages {
  REPORTED_USER_NOT_FOUND = 'Reported user not found',
  CANNOT_REPORT_SELF = 'Cannot report yourself',
  MESSAGE_NOT_FOUND = 'Message not found',
  REPORT_CREATED_SUCCESS = 'Violation report created successfully',
  UPLOAD_FAILED = 'Failed to upload file',
  TRANSACTION_FAILED = 'Failed to create violation report due to database transaction error',
  MAX_REPORT_MESSAGES_ALLOWED = 'Maximum 10 reported messages allowed',
  MAX_REPORT_IMAGES_ALLOWED = 'Maximum 5 report images allowed',
  DUPLICATE_REPORT = 'You have already reported this user within the last 24 hours',
  INVALID_FILE_TYPE = 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
  FILE_TOO_LARGE = 'File is too large. Maximum size is 10MB.',
  FILE_NOT_FOUND = 'File not found',
}
