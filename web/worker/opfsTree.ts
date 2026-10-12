/**
 * 仮想パス `/opfs/<rest>` を、OPFS のルートからのディレクトリ・ファイルのハンドルへ辿る。
 *
 * ファイルの中身はメモリに持たず、毎回 OPFS を読み書きする（OPFS が正）。書き込みは
 * `createWritable`（閉じた時点で入れ替わる）を使い、同期アクセスハンドルは取らない。
 * Service Worker が同じファイルを読みに来ても、ロックでぶつからない。
 */
import * as path from "path"

import { FsError, toFsError } from "./fsError"
import { OPFS_VIRTUAL_ROOT } from "./webPaths"

/** 辿った先 */
export type OpfsEntry =
  | { kind: "file"; handle: FileSystemFileHandle }
  | { kind: "directory"; handle: FileSystemDirectoryHandle }

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null

const getRoot = (): Promise<FileSystemDirectoryHandle> =>
  (rootPromise ??= navigator.storage.getDirectory())

/**
 * 仮想パスを OPFS のルートからの区切りにする。`/opfs` の外なら null。
 * `/opfs` そのものは空の配列（ルート）
 */
export function toOpfsSegments(filePath: string): string[] | null {
  const normalizedPath = path.normalize(filePath)
  if (normalizedPath === OPFS_VIRTUAL_ROOT) return []
  if (!normalizedPath.startsWith(`${OPFS_VIRTUAL_ROOT}/`)) return null
  return normalizedPath
    .slice(OPFS_VIRTUAL_ROOT.length + 1)
    .split("/")
    .filter((segment) => segment !== "")
}

/** 区切りを辿ってディレクトリを得る。`create` なら途中を作る */
export async function getOpfsDirectory(
  segments: readonly string[],
  options: { create: boolean; syscall: string; filePath: string }
): Promise<FileSystemDirectoryHandle> {
  try {
    let directory = await getRoot()
    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment, {
        create: options.create,
      })
    }
    return directory
  } catch (error) {
    throw toFsError(error, options.syscall, options.filePath)
  }
}

/** 区切りの指す先（ファイルかディレクトリ）。無ければ ENOENT */
export async function getOpfsEntry(
  segments: readonly string[],
  syscall: string,
  filePath: string
): Promise<OpfsEntry> {
  if (segments.length === 0) {
    return { kind: "directory", handle: await getRoot() }
  }
  const parent = await getOpfsDirectory(segments.slice(0, -1), {
    create: false,
    syscall,
    filePath,
  })
  const name = segments[segments.length - 1]
  try {
    return { kind: "file", handle: await parent.getFileHandle(name) }
  } catch (fileError) {
    if (!(fileError instanceof DOMException)) throw fileError
    // 同名のディレクトリなら TypeMismatchError、無ければ NotFoundError
    if (fileError.name !== "TypeMismatchError") {
      throw toFsError(fileError, syscall, filePath)
    }
  }
  try {
    return { kind: "directory", handle: await parent.getDirectoryHandle(name) }
  } catch (directoryError) {
    throw toFsError(directoryError, syscall, filePath)
  }
}

/** 区切りの指す先があるか */
export async function opfsEntryExists(
  segments: readonly string[]
): Promise<boolean> {
  try {
    await getOpfsEntry(segments, "access", "")
    return true
  } catch (error) {
    if (error instanceof FsError && error.code === "ENOENT") return false
    if (error instanceof FsError && error.code === "ENOTDIR") return false
    throw error
  }
}

/** ファイルを丸ごと書く。親ディレクトリが無ければ ENOENT（Node と同じ） */
export async function writeOpfsFile(
  segments: readonly string[],
  contents: Uint8Array | Blob,
  options: {
    exclusive: boolean
    append: boolean
    syscall: string
    filePath: string
  }
): Promise<void> {
  if (segments.length === 0) {
    throw new FsError("EISDIR", options.syscall, options.filePath)
  }
  const parent = await getOpfsDirectory(segments.slice(0, -1), {
    create: false,
    syscall: options.syscall,
    filePath: options.filePath,
  })
  const name = segments[segments.length - 1]
  if (options.exclusive && (await opfsEntryExists(segments))) {
    throw new FsError("EEXIST", options.syscall, options.filePath)
  }
  try {
    const fileHandle = await parent.getFileHandle(name, { create: true })
    const writable = await fileHandle.createWritable({
      keepExistingData: options.append,
    })
    if (options.append) {
      const { size } = await fileHandle.getFile()
      await writable.seek(size)
    }
    await writable.write(
      contents instanceof Blob ? contents : new Uint8Array(contents)
    )
    await writable.close()
  } catch (error) {
    if (error instanceof DOMException && error.name === "TypeMismatchError") {
      throw new FsError("EISDIR", options.syscall, options.filePath)
    }
    throw toFsError(error, options.syscall, options.filePath)
  }
}

/** ファイルかディレクトリを消す。中身のあるディレクトリは `recursive` が要る */
export async function removeOpfsEntry(
  segments: readonly string[],
  options: { recursive: boolean; syscall: string; filePath: string }
): Promise<void> {
  if (segments.length === 0) {
    throw new FsError("EPERM", options.syscall, options.filePath)
  }
  const parent = await getOpfsDirectory(segments.slice(0, -1), {
    create: false,
    syscall: options.syscall,
    filePath: options.filePath,
  })
  try {
    await parent.removeEntry(segments[segments.length - 1], {
      recursive: options.recursive,
    })
  } catch (error) {
    throw toFsError(error, options.syscall, options.filePath)
  }
}

/** ディレクトリの中の名前と種類（名前の順） */
export async function listOpfsDirectory(
  directory: FileSystemDirectoryHandle
): Promise<{ name: string; kind: FileSystemHandleKind }[]> {
  const children: { name: string; kind: FileSystemHandleKind }[] = []
  for await (const childHandle of directory.values()) {
    children.push({ name: childHandle.name, kind: childHandle.kind })
  }
  return children.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  )
}
