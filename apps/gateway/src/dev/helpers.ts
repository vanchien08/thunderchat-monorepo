import { join } from 'path'
import fs from 'fs/promises'
import path from 'path'
import { DevLogger } from './dev-logger'

export async function parseTxtFileToObject(
  relativeOrAbsolutePath: string
): Promise<Record<string, string>> {
  const filePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(__dirname, relativeOrAbsolutePath)
  const content = await fs.readFile(filePath, 'utf-8')

  const lines = content.split('\n')

  const result: Record<string, string> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue // Bỏ dòng trống & comment

    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=').trim() // xử lý nếu value có dấu '='

    if (key && value !== undefined) {
      result[key.trim()] = value
    }
  }

  return result
}

export async function clearLogFiles() {
  const logsDir = join(process.cwd(), 'logs')
  try {
    const stats = await fs.stat(logsDir)
    if (stats.isDirectory()) {
      const logFiles = (await fs.readdir(logsDir)).filter((file) => file.endsWith('.log'))
      for (const logFile of logFiles) {
        const logFilePath = join(logsDir, logFile)
        await fs.writeFile(logFilePath, '', { encoding: 'utf8' })
      }
      console.log(`>>> Cleared log all files in ${logsDir}`)
    }
  } catch (error) {
    console.log(`>>> No logs directory found at ${logsDir}`)
  }
}

export function measureTime(func: () => Promise<void>) {
  const startTime = Date.now()
  func()
    .then(() => {
      const endTime = Date.now()
      const duration = endTime - startTime
      DevLogger.logInfo(`Time taken: ${duration}ms`)
    })
    .catch((error) => {
      DevLogger.logError('Error: ', error)
    })
}
