/**
 * Worker 側の `fs/promises`。main のコードが実際に使う関数だけを、Node と同じ形で持つ。
 *
 * パスの置き場は4つ:
 * - `/opfs/<rest>` … OPFS のルート直下の `<rest>`（実ファイルの階層。`opfsTree.ts`）
 * - アプリの DB（`/opfs/data/database.db`）… sqlite-wasm の sahpool の中にあり、OPFS の
 *   階層には無い。マイグレーション前の控え（copyFile）と、新規かの判定（stat）にだけ応える
 * - 画面で選ばれたファイル（`stageFile`）… 結び付けた `File` から読む（`stagedFiles.ts`）
 * - 保存ダイアログの保存先 … 書き終えたら画面へダウンロードとして渡す（`downloadArea.ts`）
 *
 * `open` は FileHandle（`opfsFileHandle.ts`）を返し、位置を指定して読み書きできる。
 *
 * それ以外のパスは「無い」（ENOENT）と答える。
 */
import { Buffer } from "buffer"
import * as path from "path"

import {
  exportAppDatabase,
  getAppDatabaseByteLength,
  isAppDatabasePath,
  replaceAppDatabase,
} from "./appDatabase"
import {
  copyIntoDownloadStaging,
  createStagedDownloadFile,
  deliverDownload,
  deliverStagedDownload,
  isInDownloadArea,
  moveIntoDownloadStaging,
} from "./downloadArea"
import { FsError, toFsError, unsupportedFsFunction } from "./fsError"
import { WebFileHandle, type WriteOpenMode } from "./opfsFileHandle"
import {
  getOpfsDirectory,
  getOpfsEntry,
  listOpfsDirectory,
  opfsEntryExists,
  removeOpfsEntry,
  toOpfsSegments,
  writeOpfsFile,
} from "./opfsTree"
import { findStagedFile } from "./stagedFiles"
import { OPFS_VIRTUAL_ROOT } from "./webPaths"
import { WebStats } from "./webStats"

/** `fs.constants` のうち main のコードが渡しうるもの */
export const constants = {
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  COPYFILE_EXCL: 1,
  COPYFILE_FICLONE: 2,
  COPYFILE_FICLONE_FORCE: 4,
}

type PathArgument = string | URL

/** writeFile が受け取る中身 */
type WriteContents = string | ArrayBufferView | ArrayBuffer

interface ReadFileOptions {
  encoding?: BufferEncoding | null
  flag?: string
}

interface WriteFileOptions {
  encoding?: BufferEncoding | null
  mode?: number
  flag?: string
}

/** `readdir(..., { withFileTypes: true })` の1件 */
class WebDirent {
  constructor(
    readonly name: string,
    readonly parentPath: string,
    private readonly entryKind: FileSystemHandleKind
  ) {}

  get path(): string {
    return this.parentPath
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

const toPathString = (filePath: PathArgument): string =>
  path.normalize(typeof filePath === "string" ? filePath : filePath.pathname)

const toBytes = (
  contents: WriteContents,
  encoding: BufferEncoding | null | undefined
): Uint8Array => {
  if (typeof contents === "string") {
    return Buffer.from(contents, encoding ?? "utf8")
  }
  if (contents instanceof ArrayBuffer) return new Uint8Array(contents)
  return new Uint8Array(
    contents.buffer,
    contents.byteOffset,
    contents.byteLength
  )
}

const opfsSegmentsOrMissing = (filePath: string, syscall: string): string[] => {
  const segments = toOpfsSegments(filePath)
  if (segments === null) throw new FsError("ENOENT", syscall, filePath)
  return segments
}

/** 読む元の中身（Blob）。画面で選ばれたファイル・アプリの DB・OPFS のファイルのどれか */
const readSource = async (filePath: string, syscall: string): Promise<Blob> => {
  const stagedFile = findStagedFile(filePath)
  if (stagedFile !== null) return stagedFile
  if (isAppDatabasePath(filePath)) {
    return new Blob([new Uint8Array(await exportAppDatabase())])
  }
  const entry = await getOpfsEntry(
    opfsSegmentsOrMissing(filePath, syscall),
    syscall,
    filePath
  )
  if (entry.kind === "directory") throw new FsError("EISDIR", syscall, filePath)
  return entry.handle.getFile()
}

/** 書く先へ中身を置く。アプリの DB・保存ダイアログの保存先・OPFS のファイルのどれか */
const writeTarget = async (
  filePath: string,
  contents: Uint8Array | Blob,
  options: { exclusive: boolean; append: boolean; syscall: string }
): Promise<void> => {
  if (isAppDatabasePath(filePath)) {
    const bytes =
      contents instanceof Blob
        ? new Uint8Array(await contents.arrayBuffer())
        : contents
    await replaceAppDatabase(bytes)
    return
  }
  if (isInDownloadArea(filePath)) {
    if (contents instanceof Blob) {
      // OPFS のファイルは消えると画面が読めなくなるので、置き場へ写してから渡す
      await deliverStagedDownload(
        filePath,
        await copyIntoDownloadStaging(contents)
      )
    } else {
      // Blob は中身を写して持つ（Buffer の共有プールを画面へ渡さない）
      deliverDownload(filePath, new Blob([contents.slice()]))
    }
    return
  }
  await writeOpfsFile(
    opfsSegmentsOrMissing(filePath, options.syscall),
    contents,
    {
      ...options,
      filePath,
    }
  )
}

const entryExists = async (filePath: string): Promise<boolean> => {
  if (findStagedFile(filePath) !== null) return true
  if (isAppDatabasePath(filePath)) return getAppDatabaseByteLength() > 0
  if (isInDownloadArea(filePath)) return true
  const segments = toOpfsSegments(filePath)
  return segments !== null && (await opfsEntryExists(segments))
}

export async function readFile(
  filePath: PathArgument,
  options?: BufferEncoding | ReadFileOptions | null
): Promise<Buffer | string> {
  const target = toPathString(filePath)
  const source = await readSource(target, "open")
  const bytes = Buffer.from(await source.arrayBuffer())
  const encoding = typeof options === "string" ? options : options?.encoding
  return encoding ? bytes.toString(encoding) : bytes
}

export async function writeFile(
  filePath: PathArgument,
  contents: WriteContents,
  options?: BufferEncoding | WriteFileOptions | null
): Promise<void> {
  const target = toPathString(filePath)
  const encoding = typeof options === "string" ? options : options?.encoding
  const flag =
    typeof options === "object" && options !== null ? options.flag : undefined
  await writeTarget(target, toBytes(contents, encoding), {
    exclusive: flag?.includes("x") ?? false,
    append: flag?.startsWith("a") ?? false,
    syscall: "open",
  })
}

export async function appendFile(
  filePath: PathArgument,
  contents: WriteContents,
  options?: BufferEncoding | WriteFileOptions | null
): Promise<void> {
  const target = toPathString(filePath)
  const encoding = typeof options === "string" ? options : options?.encoding
  await writeTarget(target, toBytes(contents, encoding), {
    exclusive: false,
    append: true,
    syscall: "open",
  })
}

/** recursive なら途中も作り、最初に作ったパスを返す（何も作らなければ undefined。Node と同じ） */
export async function mkdir(
  filePath: PathArgument,
  options?: { recursive?: boolean; mode?: number } | number
): Promise<string | undefined> {
  const target = toPathString(filePath)
  if (isInDownloadArea(target)) return undefined
  const segments = opfsSegmentsOrMissing(target, "mkdir")
  const recursive = typeof options === "object" && options.recursive === true
  if (!recursive) {
    if (await opfsEntryExists(segments)) {
      throw new FsError("EEXIST", "mkdir", target)
    }
    const parent = await getOpfsDirectory(segments.slice(0, -1), {
      create: false,
      syscall: "mkdir",
      filePath: target,
    })
    await parent.getDirectoryHandle(segments[segments.length - 1], {
      create: true,
    })
    return undefined
  }
  // 最初に作ったパスを返すため、既にある深さを調べてから作る
  const existingDepth = await segments.reduce<Promise<number | null>>(
    async (depthPromise, _segment, segmentIndex) => {
      const depth = await depthPromise
      if (depth !== null) return depth
      return (await opfsEntryExists(segments.slice(0, segmentIndex + 1)))
        ? null
        : segmentIndex
    },
    Promise.resolve(null)
  )
  await getOpfsDirectory(segments, {
    create: true,
    syscall: "mkdir",
    filePath: target,
  })
  if (existingDepth === null) return undefined
  return path.join(OPFS_VIRTUAL_ROOT, ...segments.slice(0, existingDepth + 1))
}

export async function stat(filePath: PathArgument): Promise<WebStats> {
  const target = toPathString(filePath)
  const stagedFile = findStagedFile(target)
  if (stagedFile !== null) {
    return new WebStats("file", stagedFile.size, stagedFile.lastModified)
  }
  if (isAppDatabasePath(target)) {
    return new WebStats("file", getAppDatabaseByteLength(), Date.now())
  }
  if (isInDownloadArea(target)) return new WebStats("directory", 0, 0)
  const entry = await getOpfsEntry(
    opfsSegmentsOrMissing(target, "stat"),
    "stat",
    target
  )
  if (entry.kind === "directory") return new WebStats("directory", 0, 0)
  const file = await entry.handle.getFile()
  return new WebStats("file", file.size, file.lastModified)
}

export const lstat = stat

export async function access(filePath: PathArgument): Promise<void> {
  const target = toPathString(filePath)
  if (!(await entryExists(target)))
    throw new FsError("ENOENT", "access", target)
}

export async function realpath(filePath: PathArgument): Promise<string> {
  const target = toPathString(filePath)
  await access(target)
  return target
}

export async function readdir(
  filePath: PathArgument,
  options?: { withFileTypes?: boolean } | BufferEncoding | null
): Promise<string[] | WebDirent[]> {
  const target = toPathString(filePath)
  const entry = await getOpfsEntry(
    opfsSegmentsOrMissing(target, "scandir"),
    "scandir",
    target
  )
  if (entry.kind === "file") throw new FsError("ENOTDIR", "scandir", target)
  const children = await listOpfsDirectory(entry.handle)
  const withFileTypes =
    typeof options === "object" && options !== null && options.withFileTypes
  return withFileTypes
    ? children.map((child) => new WebDirent(child.name, target, child.kind))
    : children.map((child) => child.name)
}

export async function rm(
  filePath: PathArgument,
  options?: { recursive?: boolean; force?: boolean }
): Promise<void> {
  const target = toPathString(filePath)
  if (isInDownloadArea(target)) return
  const segments = toOpfsSegments(target)
  const exists = segments !== null && (await opfsEntryExists(segments))
  if (segments === null || !exists) {
    if (options?.force) return
    throw new FsError("ENOENT", "rm", target)
  }
  const entry = await getOpfsEntry(segments, "rm", target)
  if (entry.kind === "directory" && !options?.recursive) {
    throw new FsError("EISDIR", "rm", target)
  }
  await removeOpfsEntry(segments, {
    recursive: options?.recursive ?? false,
    syscall: "rm",
    filePath: target,
  })
}

export async function unlink(filePath: PathArgument): Promise<void> {
  const target = toPathString(filePath)
  if (isInDownloadArea(target)) return
  const segments = opfsSegmentsOrMissing(target, "unlink")
  const entry = await getOpfsEntry(segments, "unlink", target)
  if (entry.kind === "directory") throw new FsError("EPERM", "unlink", target)
  await removeOpfsEntry(segments, {
    recursive: false,
    syscall: "unlink",
    filePath: target,
  })
}

export async function rmdir(
  filePath: PathArgument,
  options?: { recursive?: boolean }
): Promise<void> {
  const target = toPathString(filePath)
  const segments = opfsSegmentsOrMissing(target, "rmdir")
  const entry = await getOpfsEntry(segments, "rmdir", target)
  if (entry.kind === "file") throw new FsError("ENOTDIR", "rmdir", target)
  await removeOpfsEntry(segments, {
    recursive: options?.recursive ?? false,
    syscall: "rmdir",
    filePath: target,
  })
}

export async function copyFile(
  sourcePath: PathArgument,
  destinationPath: PathArgument,
  mode?: number
): Promise<void> {
  const source = toPathString(sourcePath)
  const destination = toPathString(destinationPath)
  const contents = await readSource(source, "copyfile")
  await writeTarget(destination, contents, {
    exclusive: ((mode ?? 0) & constants.COPYFILE_EXCL) !== 0,
    append: false,
    syscall: "copyfile",
  })
}

/** OPFS にはファイルの付け替えが無いので、写してから消す（ディレクトリは中身ごと） */
const moveOpfsEntry = async (source: string, destination: string) => {
  const sourceSegments = opfsSegmentsOrMissing(source, "rename")
  const entry = await getOpfsEntry(sourceSegments, "rename", source)
  if (entry.kind === "file" && isInDownloadArea(destination)) {
    // 保存先へは、写さずに置き場へ移して渡す（大きな .sao をメモリにも載せない）
    const stagedFile = await moveIntoDownloadStaging(entry.handle, () =>
      removeOpfsEntry(sourceSegments, {
        recursive: false,
        syscall: "rename",
        filePath: source,
      })
    )
    await deliverStagedDownload(destination, stagedFile)
    return
  }
  if (entry.kind === "file") {
    await writeTarget(destination, await entry.handle.getFile(), {
      exclusive: false,
      append: false,
      syscall: "rename",
    })
  } else {
    await mkdir(destination, { recursive: true })
    const children = await listOpfsDirectory(entry.handle)
    for (const child of children) {
      await moveOpfsEntry(
        path.join(source, child.name),
        path.join(destination, child.name)
      )
    }
  }
  await removeOpfsEntry(sourceSegments, {
    recursive: true,
    syscall: "rename",
    filePath: source,
  })
}

export async function rename(
  sourcePath: PathArgument,
  destinationPath: PathArgument
): Promise<void> {
  const source = toPathString(sourcePath)
  const destination = toPathString(destinationPath)
  if (source === destination) return
  await moveOpfsEntry(source, destination)
}

const TEMPORARY_SUFFIX_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

/** 接頭辞に6文字足したディレクトリを作って返す（Node と同じ） */
export async function mkdtemp(prefix: string): Promise<string> {
  const randomValues = crypto.getRandomValues(new Uint8Array(6))
  const suffix = Array.from(
    randomValues,
    (randomValue) =>
      TEMPORARY_SUFFIX_CHARACTERS[
        randomValue % TEMPORARY_SUFFIX_CHARACTERS.length
      ]
  ).join("")
  const directoryPath = `${prefix}${suffix}`
  await mkdir(directoryPath)
  return directoryPath
}

/** Node の flags → 書き込みの開き方。読むだけなら null */
const WRITE_OPEN_MODES: Record<string, WriteOpenMode | null> = {
  r: null,
  w: "truncate",
  wx: "exclusive",
  a: "append",
}

/** 書くハンドルを OPFS のファイルに開く。親ディレクトリが無ければ ENOENT（Node と同じ） */
const openOpfsFileForWriting = async (
  target: string,
  mode: WriteOpenMode
): Promise<WebFileHandle> => {
  const segments = opfsSegmentsOrMissing(target, "open")
  if (segments.length === 0) throw new FsError("EISDIR", "open", target)
  if (mode === "exclusive" && (await opfsEntryExists(segments))) {
    throw new FsError("EEXIST", "open", target)
  }
  const parent = await getOpfsDirectory(segments.slice(0, -1), {
    create: false,
    syscall: "open",
    filePath: target,
  })
  let fileHandle: FileSystemFileHandle
  try {
    fileHandle = await parent.getFileHandle(segments[segments.length - 1], {
      create: true,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TypeMismatchError") {
      throw new FsError("EISDIR", "open", target)
    }
    throw toFsError(error, "open", target)
  }
  return WebFileHandle.forWriting(
    target,
    fileHandle,
    mode,
    async () => undefined
  )
}

/**
 * ファイルを開く（`r`・`w`・`wx`・`a`）。保存ダイアログの保存先へ書くハンドルは、OPFS の置き場に
 * 書き、閉じた時点で画面へ渡す
 */
export async function open(
  filePath: PathArgument,
  flags: string = "r"
): Promise<WebFileHandle> {
  const target = toPathString(filePath)
  const mode = WRITE_OPEN_MODES[flags]
  if (mode === undefined)
    throw unsupportedFsFunction(`promises.open（${flags}）`)
  if (mode === null) {
    return WebFileHandle.forReading(target, await readSource(target, "open"))
  }
  if (isAppDatabasePath(target)) {
    throw unsupportedFsFunction("promises.open（アプリの DB へ書く）")
  }
  if (isInDownloadArea(target)) {
    const stagedFile = await createStagedDownloadFile()
    return WebFileHandle.forWriting(target, stagedFile, mode, () =>
      deliverStagedDownload(target, stagedFile)
    )
  }
  return openOpfsFileForWriting(target, mode)
}
