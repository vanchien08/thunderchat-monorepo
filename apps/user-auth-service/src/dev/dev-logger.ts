import { Request } from 'express'
import { appendFile, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export class DevLogger {
  private static logDir: string = join(process.cwd(), 'logs')
  private static infoLogFile: string = join(this.logDir, 'info.log')
  private static esQueryLogFile: string = join(this.logDir, 'es-search.log')
  private static incomingRequestsLogFile: string = join(this.logDir, 'incoming-requests.log')
  private static errorsLogFile: string = join(this.logDir, 'errors.log')
  private static sqlQueriesLogFile: string = join(this.logDir, 'sql-queries.log')
  private static websocketLogFile: string = join(this.logDir, 'websocket.log')
  private static maxDepth: number = 6

  static safeStringifyMessage(
    msg: any,
    depth = 0,
    maxDepth = this.maxDepth,
    seen = new WeakSet()
  ): string {
    const indent = (level: number) => '  '.repeat(level)

    if (depth > maxDepth) return '[Object depth exceeded]'

    if (msg === null) return 'null'
    if (typeof msg === 'undefined') return 'undefined'
    if (typeof msg === 'string') return `"${msg}"`
    if (typeof msg === 'number' || typeof msg === 'boolean') return String(msg)
    if (typeof msg === 'function') return '[Function]'
    if (typeof msg === 'symbol') return '[Symbol]'

    if (Array.isArray(msg)) {
      const items = msg
        .map(
          (item, idx) =>
            `${indent(depth + 1)}[${idx}]: ${this.safeStringifyMessage(item, depth + 1, maxDepth, seen)}`
        )
        .join('\n')

      return `[Array] [\n${items}\n${indent(depth)}]`
    }

    if (typeof msg === 'object') {
      if (seen.has(msg)) return '[Circular]'
      seen.add(msg)

      const entries = Object.entries(msg).map(
        ([key, value]) =>
          `${indent(depth + 1)}${key}: ${this.safeStringifyMessage(value, depth + 1, maxDepth, seen)}`
      )

      seen.delete(msg)

      return `[Object] {\n${entries.join(',\n')}\n${indent(depth)}}`
    }

    return String(msg)
  }

  static logInfo(...messages: any[]) {
    queueMicrotask(() => {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true })
      }

      const logMessage =
        '>>> ' + messages.map((msg) => this.safeStringifyMessage(msg)).join('\n') + '\n'

      appendFile(this.infoLogFile, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
          console.error('>>> Error writing to log file:', err)
        } else {
          console.log(`>>> [${new Date().toISOString()}]: Log file written successfully`)
        }
      })
    })
  }

  static logESQuery(...messages: any[]) {
    queueMicrotask(() => {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true })
      }

      const logMessage =
        '>>> ' + messages.map((msg) => this.safeStringifyMessage(msg)).join('\n') + '\n'

      appendFile(this.esQueryLogFile, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
          console.error('>>> Error writing to log file:', err)
        } else {
          console.log(`>>> [${new Date().toISOString()}]: Log file written successfully`)
        }
      })
    })
  }

  static logIncomingRequest(req: Request) {
    queueMicrotask(() => {
      const logMessage =
        `[use] Coming Request: ${req.method} ${req.url}
          +) Headers: ${JSON.stringify(req.headers, null, 2)}
          +) Params: ${JSON.stringify(req.params, null, 2)}
          +) Query: ${JSON.stringify(req.query, null, 2)}
          +) Body: ${JSON.stringify(req.body, null, 2)}` + '\n'

      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true })
      }

      appendFile(this.incomingRequestsLogFile, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
          console.error('>>> Error writing to log file:', err)
        } else {
          console.log(`>>> [${new Date().toISOString()}]: Log file written successfully`)
        }
      })
    })
  }

  static logError(...messages: any[]) {
    queueMicrotask(() => {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true })
      }

      // Ghi mỗi message trên 1 dòng, nếu là object thì log theo format object
      const logMessage =
        '>>> ' + messages.map((msg) => this.safeStringifyMessage(msg)).join('\n') + '\n'

      appendFile(this.errorsLogFile, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
          console.error('>>> Error writing to log file:', err)
        } else {
          console.log(`>>> [${new Date().toISOString()}]: Log file written successfully`)
        }
      })
    })
  }

  static logSQLQuery(queryStatement: string, params: any, duration: number) {
    queueMicrotask(() => {
      const logMessage =
        `>>> SQL Query: ${queryStatement}
          +) Params: ${JSON.stringify(params, null, 2)}
          +) Duration: ${duration}ms` + '\n'

      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true })
      }

      appendFile(this.sqlQueriesLogFile, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
          console.error('>>> Error writing to log file:', err)
        }
      })
    })
  }

  static logForWebsocket(...messages: (string | object)[]) {
    queueMicrotask(() => {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true })
      }

      // Ghi mỗi message trên 1 dòng, nếu là object thì log theo format object
      const logMessage =
        '>>> ' + messages.map((msg) => this.safeStringifyMessage(msg)).join('\n') + '\n'

      appendFile(this.websocketLogFile, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
          console.error('>>> Error writing to log file:', err)
        } else {
          console.log(`>>> [${new Date().toISOString()}]: Log file written successfully`)
        }
      })
    })
  }
}
