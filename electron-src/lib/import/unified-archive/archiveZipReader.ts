/**
 * 統合アーカイブ（.sao）の ZIP を読む
 *
 * デスクトップ版と web 版で同じコードを使う（Node 専用のモジュールを使わない。伸張は fflate）。
 * 項目の一覧は中央ディレクトリから読む（ローカルヘッダーを先頭から辿らない）。書いた道具に
 * よらず読めるように: archiver（旧版のデスクトップ版の書き出し）・fflate（今の書き出し）・
 * adm-zip（テスト）が書いたもの、データ記述子つきの項目、ZIP64 を読む。
 *
 * ファイルは `fs/promises` の FileHandle で位置を指定して読む（web 版は `web/worker/opfsFs.ts` の
 * FileHandle）。メモリに載せるのは、終わりの記録・中央ディレクトリと、`read` を呼んだ項目の中身
 * だけで、ファイル全体は読まない（Node の readFile は 2GiB を超えるファイルを読めない）。
 * 暗号化された項目と、無圧縮・deflate 以外の圧縮は断る。
 */

import { inflateSync } from "fflate"
import * as fsPromises from "fs/promises"

import { crc32Of } from "../../export/unified-archive/archiveZipCrc32"

/** ZIP として読めない（壊れている・想定外の作り） */
export class ArchiveZipFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArchiveZipFormatError"
  }
}

/** 中央ディレクトリの項目1つ */
export interface ArchiveZipEntry {
  /** ZIP の中の名前（区切りは "/"。ディレクトリの項目は末尾が "/"） */
  readonly name: string
  readonly isDirectory: boolean
  /** 伸張し、CRC と大きさを確かめた中身。合わなければ `ArchiveZipFormatError` */
  readonly read: () => Promise<Uint8Array>
}

/** 開いた ZIP。読み終えたら `close` する */
export interface ArchiveZip {
  readonly entries: readonly ArchiveZipEntry[]
  readonly close: () => Promise<void>
}

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50

const END_OF_CENTRAL_DIRECTORY_SIZE = 22
const ZIP64_LOCATOR_SIZE = 20
const CENTRAL_DIRECTORY_HEADER_SIZE = 46
const LOCAL_FILE_HEADER_SIZE = 30
/** 終わりの記録の後ろに付けられる注釈の最大長 */
const MAX_COMMENT_LENGTH = 0xffff

const ZIP64_EXTRA_FIELD_ID = 0x0001
/** 32ビットの欄がこの値なら、本当の値は ZIP64 の拡張欄にある */
const ZIP64_MARKER_32 = 0xffffffff
const ZIP64_MARKER_16 = 0xffff

const ENCRYPTED_FLAG = 0x0001
const COMPRESSION_STORED = 0
const COMPRESSION_DEFLATE = 8

const nameDecoder = new TextDecoder("utf-8")

/**
 * ファイルの一部（`baseOffset` から）を読んだもの。欄の位置はファイルの先頭からで指し、
 * 範囲を確かめて読む（ZIP の欄が外を指していても、読み違えずに断る）
 */
class ZipBytes {
  private readonly view: DataView

  constructor(
    readonly bytes: Uint8Array,
    readonly baseOffset: number
  ) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  private toLocal(offset: number, length: number, label: string): number {
    const localOffset = offset - this.baseOffset
    if (
      localOffset < 0 ||
      length < 0 ||
      localOffset + length > this.bytes.byteLength
    ) {
      throw new ArchiveZipFormatError(`${label} が読んだ範囲の外を指している`)
    }
    return localOffset
  }

  uint16(offset: number, label: string): number {
    return this.view.getUint16(this.toLocal(offset, 2, label), true)
  }

  uint32(offset: number, label: string): number {
    return this.view.getUint32(this.toLocal(offset, 4, label), true)
  }

  uint64(offset: number, label: string): number {
    const value = this.view.getBigUint64(this.toLocal(offset, 8, label), true)
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ArchiveZipFormatError(`${label} が大きすぎる`)
    }
    return Number(value)
  }

  slice(offset: number, length: number, label: string): Uint8Array {
    const localOffset = this.toLocal(offset, length, label)
    return this.bytes.subarray(localOffset, localOffset + length)
  }
}

/** 位置を指定して読む口（FileHandle を包む） */
interface ZipFile {
  readonly size: number
  readonly read: (
    position: number,
    length: number,
    label: string
  ) => Promise<ZipBytes>
}

const openZipFile = async (
  fileHandle: fsPromises.FileHandle
): Promise<ZipFile> => {
  const { size } = await fileHandle.stat()
  return {
    size,
    read: async (position, length, label) => {
      if (position < 0 || length < 0 || position + length > size) {
        throw new ArchiveZipFormatError(`${label} がファイルの外を指している`)
      }
      const bytes = new Uint8Array(length)
      let filled = 0
      while (filled < length) {
        const { bytesRead } = await fileHandle.read(
          bytes,
          filled,
          length - filled,
          position + filled
        )
        if (bytesRead === 0) {
          throw new ArchiveZipFormatError(`${label} を読み切れない`)
        }
        filled += bytesRead
      }
      return new ZipBytes(bytes, position)
    },
  }
}

/** 中央ディレクトリの場所と項目の数 */
interface CentralDirectoryLocation {
  readonly offset: number
  readonly size: number
  readonly entryCount: number
}

/** ファイルの末尾（終わりの記録と、その後ろの注釈が入りうる長さ）から、終わりの記録を探す */
const findEndOfCentralDirectory = (
  tail: ZipBytes,
  fileSize: number
): number => {
  const lastCandidate = fileSize - END_OF_CENTRAL_DIRECTORY_SIZE
  for (let offset = lastCandidate; offset >= tail.baseOffset; offset--) {
    if (
      tail.uint32(offset, "終わりの記録") === END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return offset
    }
  }
  throw new ArchiveZipFormatError("ZIP の終わりの記録が無い")
}

const ZIP64_END_OF_CENTRAL_DIRECTORY_SIZE = 56

const locateCentralDirectory = async (
  zipFile: ZipFile
): Promise<CentralDirectoryLocation> => {
  if (zipFile.size < END_OF_CENTRAL_DIRECTORY_SIZE) {
    throw new ArchiveZipFormatError("ZIP として短すぎる")
  }
  // ZIP64 の位置の記録は終わりの記録の直前にあるので、その分も合わせて読む
  const tailLength = Math.min(
    zipFile.size,
    END_OF_CENTRAL_DIRECTORY_SIZE + MAX_COMMENT_LENGTH + ZIP64_LOCATOR_SIZE
  )
  const tail = await zipFile.read(
    zipFile.size - tailLength,
    tailLength,
    "ファイルの末尾"
  )
  const endOffset = findEndOfCentralDirectory(tail, zipFile.size)
  const locatorOffset = endOffset - ZIP64_LOCATOR_SIZE
  const hasZip64Locator =
    locatorOffset >= tail.baseOffset &&
    tail.uint32(locatorOffset, "ZIP64 の位置の記録") ===
      ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE
  if (!hasZip64Locator) {
    return {
      entryCount: tail.uint16(endOffset + 10, "項目の数"),
      size: tail.uint32(endOffset + 12, "中央ディレクトリの大きさ"),
      offset: tail.uint32(endOffset + 16, "中央ディレクトリの位置"),
    }
  }
  const zip64EndOffset = tail.uint64(
    locatorOffset + 8,
    "ZIP64 の終わりの記録の位置"
  )
  const zip64End = await zipFile.read(
    zip64EndOffset,
    ZIP64_END_OF_CENTRAL_DIRECTORY_SIZE,
    "ZIP64 の終わりの記録"
  )
  if (
    zip64End.uint32(zip64EndOffset, "ZIP64 の終わりの記録") !==
    ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE
  ) {
    throw new ArchiveZipFormatError("ZIP64 の終わりの記録が無い")
  }
  return {
    entryCount: zip64End.uint64(zip64EndOffset + 32, "項目の数"),
    size: zip64End.uint64(zip64EndOffset + 40, "中央ディレクトリの大きさ"),
    offset: zip64End.uint64(zip64EndOffset + 48, "中央ディレクトリの位置"),
  }
}

/** ZIP64 の拡張欄から、32ビットに収まらなかった欄を読む（無い欄は元の値のまま） */
const readZip64Sizes = (
  zip: ZipBytes,
  extraOffset: number,
  extraLength: number,
  declared: { uncompressedSize: number; compressedSize: number; offset: number }
): { uncompressedSize: number; compressedSize: number; offset: number } => {
  const extraEnd = extraOffset + extraLength
  let fieldOffset = extraOffset
  while (fieldOffset + 4 <= extraEnd) {
    const fieldId = zip.uint16(fieldOffset, "拡張欄")
    const fieldLength = zip.uint16(fieldOffset + 2, "拡張欄の長さ")
    if (fieldId === ZIP64_EXTRA_FIELD_ID) {
      // 32ビットの欄が印の値だったものだけが、この順に並ぶ
      let valueOffset = fieldOffset + 4
      const takeValue = (declaredValue: number, label: string): number => {
        if (declaredValue !== ZIP64_MARKER_32) return declaredValue
        const value = zip.uint64(valueOffset, label)
        valueOffset += 8
        return value
      }
      const uncompressedSize = takeValue(
        declared.uncompressedSize,
        "伸張後の大きさ"
      )
      const compressedSize = takeValue(
        declared.compressedSize,
        "圧縮後の大きさ"
      )
      const offset = takeValue(declared.offset, "項目の位置")
      return { uncompressedSize, compressedSize, offset }
    }
    fieldOffset += 4 + fieldLength
  }
  return declared
}

/** ローカルヘッダーを読み、中身の始まりを返す */
const dataOffsetOf = async (
  zipFile: ZipFile,
  localHeaderOffset: number
): Promise<number> => {
  const header = await zipFile.read(
    localHeaderOffset,
    LOCAL_FILE_HEADER_SIZE,
    "ローカルヘッダー"
  )
  if (
    header.uint32(localHeaderOffset, "ローカルヘッダー") !==
    LOCAL_FILE_HEADER_SIGNATURE
  ) {
    throw new ArchiveZipFormatError("ローカルヘッダーが無い")
  }
  const nameLength = header.uint16(localHeaderOffset + 26, "名前の長さ")
  const extraLength = header.uint16(localHeaderOffset + 28, "拡張欄の長さ")
  return localHeaderOffset + LOCAL_FILE_HEADER_SIZE + nameLength + extraLength
}

const decompress = (
  name: string,
  compressed: Uint8Array,
  compression: number,
  uncompressedSize: number
): Uint8Array => {
  if (compression === COMPRESSION_STORED) {
    if (compressed.byteLength !== uncompressedSize) {
      throw new ArchiveZipFormatError(`${name}: 大きさが記録と合わない`)
    }
    return compressed
  }
  try {
    // 記録された大きさの器に伸張する（それより大きく伸びるものは切れて、下の検査で断る）
    return inflateSync(compressed, { out: new Uint8Array(uncompressedSize) })
  } catch (error) {
    throw new ArchiveZipFormatError(
      `${name}: 伸張できない（${error instanceof Error ? error.message : String(error)}）`
    )
  }
}

/** 中央ディレクトリから項目の一覧を読む */
const readCentralDirectory = async (
  zipFile: ZipFile
): Promise<ArchiveZipEntry[]> => {
  const centralDirectory = await locateCentralDirectory(zipFile)
  const zip = await zipFile.read(
    centralDirectory.offset,
    centralDirectory.size,
    "中央ディレクトリ"
  )
  const entries: ArchiveZipEntry[] = []
  let headerOffset = centralDirectory.offset
  for (
    let entryIndex = 0;
    entryIndex < centralDirectory.entryCount;
    entryIndex++
  ) {
    if (
      zip.uint32(headerOffset, "中央ディレクトリの項目") !==
      CENTRAL_DIRECTORY_HEADER_SIGNATURE
    ) {
      throw new ArchiveZipFormatError("中央ディレクトリの項目が壊れている")
    }
    const flags = zip.uint16(headerOffset + 8, "項目の印")
    const compression = zip.uint16(headerOffset + 10, "圧縮の方式")
    const expectedCrc = zip.uint32(headerOffset + 16, "CRC")
    const nameLength = zip.uint16(headerOffset + 28, "名前の長さ")
    const extraLength = zip.uint16(headerOffset + 30, "拡張欄の長さ")
    const commentLength = zip.uint16(headerOffset + 32, "注釈の長さ")
    const startDisk = zip.uint16(headerOffset + 34, "開始ディスク")
    const nameOffset = headerOffset + CENTRAL_DIRECTORY_HEADER_SIZE
    const name = nameDecoder.decode(zip.slice(nameOffset, nameLength, "名前"))
    const sizes = readZip64Sizes(zip, nameOffset + nameLength, extraLength, {
      compressedSize: zip.uint32(headerOffset + 20, "圧縮後の大きさ"),
      uncompressedSize: zip.uint32(headerOffset + 24, "伸張後の大きさ"),
      offset: zip.uint32(headerOffset + 42, "項目の位置"),
    })
    headerOffset = nameOffset + nameLength + extraLength + commentLength

    if (startDisk !== 0 && startDisk !== ZIP64_MARKER_16) {
      throw new ArchiveZipFormatError(`${name}: 分割された ZIP は読めない`)
    }
    if ((flags & ENCRYPTED_FLAG) !== 0) {
      throw new ArchiveZipFormatError(`${name}: 暗号化されている`)
    }
    if (
      compression !== COMPRESSION_STORED &&
      compression !== COMPRESSION_DEFLATE
    ) {
      throw new ArchiveZipFormatError(
        `${name}: 読めない圧縮の方式（${compression}）`
      )
    }
    entries.push({
      name,
      isDirectory: name.endsWith("/"),
      read: async () => {
        const dataOffset = await dataOffsetOf(zipFile, sizes.offset)
        const compressed = (
          await zipFile.read(dataOffset, sizes.compressedSize, `${name} の中身`)
        ).bytes
        const content = decompress(
          name,
          compressed,
          compression,
          sizes.uncompressedSize
        )
        if (content.byteLength !== sizes.uncompressedSize) {
          throw new ArchiveZipFormatError(`${name}: 大きさが記録と合わない`)
        }
        if (crc32Of(content) !== expectedCrc) {
          throw new ArchiveZipFormatError(`${name}: CRC が合わない`)
        }
        return content
      },
    })
  }
  return entries
}

/**
 * ZIP のファイルを開き、項目の一覧を読む。ZIP として読めなければ `ArchiveZipFormatError`
 * （開けなければ fs の例外）。中身は返した項目の `read` で取り出し、終わったら `close` する
 */
export async function openArchiveZip(filePath: string): Promise<ArchiveZip> {
  const fileHandle = await fsPromises.open(filePath, "r")
  try {
    const entries = await readCentralDirectory(await openZipFile(fileHandle))
    return { entries, close: () => fileHandle.close() }
  } catch (error) {
    await fileHandle.close()
    throw error
  }
}
