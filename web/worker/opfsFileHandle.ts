/**
 * Worker 側の `fsPromises.open` が返す FileHandle。main のコードが使う分だけ
 * （`read`・`write` の位置指定・`stat`・`close`）を Node と同じ形で持つ。
 *
 * - 読む: 開いた時点の `File`（OPFS のファイル・画面で選ばれたファイル・アプリの DB の中身）を
 *   `slice` で必要な分だけ読む。ファイル全体をメモリに載せない
 * - 書く: Worker だけで使える `createSyncAccessHandle` で、位置を指定して書く。実測で
 *   `createWritable` を開いたまま書くより約5倍速く、書き足すたびに開き直す形（appendFile）より
 *   桁違いに速い。開いている間も `getFile()`（Service Worker の画像の読み取り）は読めて、
 *   ぶつかるのは同じファイルへのほかの書き込みだけ（EPERM になる）
 */
import { FsError, toFsError } from "./fsError"
import { WebStats } from "./webStats"

/** `createSyncAccessHandle` が返すもの（TypeScript の dom の型には無い） */
interface SyncAccessHandle {
  read: (buffer: Uint8Array, options: { at: number }) => number
  write: (buffer: Uint8Array, options: { at: number }) => number
  truncate: (size: number) => void
  getSize: () => number
  flush: () => void
  close: () => void
}

interface SyncAccessCapable {
  createSyncAccessHandle: () => Promise<SyncAccessHandle>
}

const supportsSyncAccess = (
  fileHandle: FileSystemFileHandle
): fileHandle is FileSystemFileHandle & SyncAccessCapable =>
  "createSyncAccessHandle" in fileHandle &&
  typeof fileHandle.createSyncAccessHandle === "function"

/** 書き込みの開き方（Node の flags のうち使うもの） */
export type WriteOpenMode = "truncate" | "exclusive" | "append"

interface ReadResult {
  bytesRead: number
  buffer: Uint8Array
}

interface WriteResult {
  bytesWritten: number
  buffer: Uint8Array
}

const notOpen = (syscall: string, filePath: string): Error =>
  new FsError("EPERM", syscall, filePath)

export class WebFileHandle {
  private position = 0
  private closed = false

  private constructor(
    private readonly filePath: string,
    private readonly source: Blob | null,
    private readonly syncAccess: SyncAccessHandle | null,
    private readonly onClose: () => Promise<void>
  ) {}

  /** 読むだけのハンドル。`source` は開いた時点の中身 */
  static forReading(filePath: string, source: Blob): WebFileHandle {
    return new WebFileHandle(filePath, source, null, async () => undefined)
  }

  /** 書くハンドル。閉じたあとに `onClose` を呼ぶ（保存先へ渡すなど） */
  static async forWriting(
    filePath: string,
    fileHandle: FileSystemFileHandle,
    mode: WriteOpenMode,
    onClose: () => Promise<void>
  ): Promise<WebFileHandle> {
    if (!supportsSyncAccess(fileHandle)) {
      throw new Error(
        "[web] このブラウザは OPFS の createSyncAccessHandle に対応していない"
      )
    }
    let syncAccess: SyncAccessHandle
    try {
      syncAccess = await fileHandle.createSyncAccessHandle()
    } catch (error) {
      throw toFsError(error, "open", filePath)
    }
    if (mode !== "append") syncAccess.truncate(0)
    const handle = new WebFileHandle(filePath, null, syncAccess, onClose)
    handle.position = mode === "append" ? syncAccess.getSize() : 0
    return handle
  }

  /** `read(buffer, offset, length, position)`。position が null なら続きから */
  async read(
    buffer: Uint8Array,
    offset = 0,
    length = buffer.byteLength - offset,
    position: number | null = null
  ): Promise<ReadResult> {
    if (this.closed) throw notOpen("read", this.filePath)
    const start = position ?? this.position
    const target = buffer.subarray(offset, offset + length)
    let bytesRead: number
    if (this.syncAccess !== null) {
      bytesRead = this.syncAccess.read(target, { at: start })
    } else if (this.source !== null) {
      const chunk = new Uint8Array(
        await this.source.slice(start, start + length).arrayBuffer()
      )
      target.set(chunk)
      bytesRead = chunk.byteLength
    } else {
      bytesRead = 0
    }
    if (position === null) this.position = start + bytesRead
    return { bytesRead, buffer }
  }

  /** `write(buffer, offset, length, position)`。position が null なら続きへ */
  async write(
    buffer: Uint8Array,
    offset = 0,
    length = buffer.byteLength - offset,
    position: number | null = null
  ): Promise<WriteResult> {
    if (this.closed || this.syncAccess === null) {
      throw notOpen("write", this.filePath)
    }
    const start = position ?? this.position
    const bytesWritten = this.syncAccess.write(
      buffer.subarray(offset, offset + length),
      { at: start }
    )
    if (position === null) this.position = start + bytesWritten
    return { bytesWritten, buffer }
  }

  async stat(): Promise<WebStats> {
    if (this.closed) throw notOpen("fstat", this.filePath)
    const size =
      this.syncAccess !== null
        ? this.syncAccess.getSize()
        : (this.source?.size ?? 0)
    const modifiedAt =
      this.source instanceof File ? this.source.lastModified : Date.now()
    return new WebStats("file", size, modifiedAt)
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (this.syncAccess !== null) {
      this.syncAccess.flush()
      this.syncAccess.close()
    }
    await this.onClose()
  }
}
