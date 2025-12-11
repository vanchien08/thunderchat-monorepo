export class SystemException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'System Exception'
  }
}

export class UnknownException extends SystemException {
  private originalError?: Error

  constructor(message: string, originalError?: Error) {
    super(message)
    this.name = 'Unknown Exception'
    if (originalError) {
      this.originalError = originalError
      this.stack = originalError.stack
    }
  }

  getOriginalError(): Error | undefined {
    return this.originalError
  }
}

export class ConnectionException extends SystemException {
  private originalError?: Error

  constructor(message: string, originalError?: Error) {
    super(message)
    this.name = 'Unknown Exception'
    if (originalError) {
      this.originalError = originalError
      this.stack = originalError.stack
    }
  }

  getOriginalError(): Error | undefined {
    return this.originalError
  }
}

export class WorkerResponseException extends SystemException {
  private originalError?: Error

  constructor(message: string, originalError?: Error) {
    super(message)
    this.name = 'Worker Response Exception'
    if (originalError) {
      this.originalError = originalError
      this.stack = originalError.stack
    }
  }

  getOriginalError(): Error | undefined {
    return this.originalError
  }
}

export class WorkerInputDataException extends SystemException {
  private originalError?: Error

  constructor(message: string, originalError?: Error) {
    super(message)
    this.name = 'Worker Input Data Exception'
    if (originalError) {
      this.originalError = originalError
      this.stack = originalError.stack
    }
  }

  getOriginalError(): Error | undefined {
    return this.originalError
  }
}

export class BulkDeleteException extends SystemException {
  constructor(message: string) {
    super(message)
    this.name = 'Elasticsearch Bulk Delete Exception'
  }
}
