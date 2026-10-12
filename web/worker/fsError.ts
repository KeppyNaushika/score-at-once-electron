/**
 * Node の fs と同じ形の例外（`code`・`syscall`・`path`）。main のコードは `error.code === "ENOENT"`
 * で「無い」を見分けるので、OPFS の DOMException はここで Node の形にする。
 */

/** main のコードが見分ける fs のエラーコード */
export type FsErrorCode =
  "ENOENT" | "EEXIST" | "ENOTDIR" | "EISDIR" | "ENOTEMPTY" | "EPERM"

const FS_ERROR_DESCRIPTIONS: Record<FsErrorCode, string> = {
  ENOENT: "no such file or directory",
  EEXIST: "file already exists",
  ENOTDIR: "not a directory",
  EISDIR: "illegal operation on a directory",
  ENOTEMPTY: "directory not empty",
  EPERM: "operation not permitted",
}

export class FsError extends Error {
  readonly code: FsErrorCode
  readonly syscall: string
  readonly path: string

  constructor(code: FsErrorCode, syscall: string, filePath: string) {
    super(`${code}: ${FS_ERROR_DESCRIPTIONS[code]}, ${syscall} '${filePath}'`)
    this.name = "Error"
    this.code = code
    this.syscall = syscall
    this.path = filePath
  }
}

/** OPFS の例外（DOMException）を Node の形にする。対応の無いものはそのまま返す */
export function toFsError(
  error: unknown,
  syscall: string,
  filePath: string
): unknown {
  if (error instanceof FsError || !(error instanceof DOMException)) return error
  switch (error.name) {
    case "NotFoundError":
      return new FsError("ENOENT", syscall, filePath)
    case "TypeMismatchError":
      return new FsError("ENOTDIR", syscall, filePath)
    case "InvalidModificationError":
      return new FsError("ENOTEMPTY", syscall, filePath)
    case "NoModificationAllowedError":
      return new FsError("EPERM", syscall, filePath)
    default:
      return error
  }
}

/** web 版で使えない fs の関数（同期版など）が呼ばれたときの例外 */
export function unsupportedFsFunction(functionName: string): Error {
  return new Error(`[web] fs.${functionName} は web 版では未対応`)
}
