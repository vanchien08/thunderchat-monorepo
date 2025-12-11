import { copy, remove, pathExists } from 'fs-extra'
import { resolve } from 'path'

/**
 * Copy toàn bộ nội dung từ thư mục nguồn sang thư mục đích.
 * Dùng cho việc đồng bộ thư mục (ví dụ: copy protos trước khi chạy server).
 *
 * @param fromPath - Đường dẫn nguồn (thư mục cần copy)
 * @param toPath   - Đường dẫn đích (thư mục sẽ được ghi đè)
 */
export async function copyProtos(fromPath: string, toPath: string) {
  const srcDir = resolve(fromPath)
  const destDir = resolve(toPath)

  if (!(await pathExists(srcDir))) {
    throw new Error(`Source directory does not exist: ${srcDir}`)
  }

  await remove(destDir)
  await copy(srcDir, destDir)
}
