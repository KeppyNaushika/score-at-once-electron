/**
 * Worker 側の `fs.Stats`（`opfsFs.ts` の stat と、FileHandle の stat が返す）
 */

/** `fs.Stats` のうち main のコードが読むもの */
export class WebStats {
  readonly size: number
  readonly mtime: Date
  readonly mtimeMs: number
  readonly atime: Date
  readonly ctime: Date
  readonly birthtime: Date
  readonly mode: number

  constructor(
    private readonly entryKind: "file" | "directory",
    size: number,
    modifiedAt: number
  ) {
    this.size = size
    this.mtimeMs = modifiedAt
    this.mtime = new Date(modifiedAt)
    this.atime = this.mtime
    this.ctime = this.mtime
    this.birthtime = this.mtime
    this.mode = entryKind === "directory" ? 0o40755 : 0o100644
  }

  isFile(): boolean {
    return this.entryKind === "file"
  }

  isDirectory(): boolean {
    return this.entryKind === "directory"
  }

  isSymbolicLink(): boolean {
    return false
  }
}
