export enum EAdminMessages {
  // System Overview
  SYSTEM_OVERVIEW_SUCCESS = 'System overview retrieved successfully',
  SYSTEM_OVERVIEW_ERROR = 'Failed to retrieve system overview',
  INVALID_TIME_RANGE = 'Invalid time range provided',
  INVALID_DATE_RANGE = 'Invalid date range provided',

  // User Management
  USER_LOCKED_SUCCESS = 'User locked successfully',
  USER_UNLOCKED_SUCCESS = 'User unlocked successfully',
  USER_NOT_FOUND = 'User not found',
  EMAIL_ALREADY_EXISTS = 'Email already exists',
  USER_EMAIL_UPDATED_SUCCESS = 'User email updated successfully',

  // General
  ADMIN_ACCESS_REQUIRED = 'Admin access required',
  OPERATION_SUCCESS = 'Operation completed successfully',
  OPERATION_FAILED = 'Operation failed',
}
