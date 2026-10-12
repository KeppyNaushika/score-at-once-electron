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
 *
 * 外から来たファイルなので、伸ばす前に大きさの上限（{@link ArchiveZipLimits}）を確かめ、
 * 項目のデータの範囲が互いに重なるもの（同じ圧縮データを何度も伸ばさせる作り）も断る。
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

/**
 * 大きさの上限を超える ZIP（伸ばすと大きくなりすぎる・項目が多すぎる・縮み方が不自然）。
 * 壊れているのではないので、`ArchiveZipFormatError` とは分ける
 */
export class ArchiveZipLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArchiveZipLimitError"
  }
}

/**
 * ZIP を読むときの大きさの上限。既定は {@link DEFAULT_ARCHIVE_ZIP_LIMITS}
 * （テストは小さくして、大きなファイルを作らずに確かめる）
 */
export interface ArchiveZipLimits {
  /** 項目の数 */
  readonly maxEntries: number
  /** 1項目の伸張後の大きさ（`read` は1項目をまるごとメモリに載せる） */
  readonly maxEntryUncompressedBytes: number
  /** 全項目の伸張後の大きさの合計 */
  readonly maxTotalUncompressedBytes: number
  /** 伸張後 ÷ 圧縮後の上限（1項目ごとと、全体の合計の両方で見る） */
  readonly maxCompressionRatio: number
  /** この大きさ以下なら縮み方を問わない（小さな DB や空に近いファイルは大きく縮む） */
  readonly compressionRatioExemptBytes: number
}

const MEBIBYTE = 1024 * 1024
const GIBIBYTE = 1024 * MEBIBYTE

/**
 * 既定の上限。書き出し（`archiveZipWriter.ts`）が作りうる正当なものは断らない値にする。
 *
 * - 項目の数: 100万。項目は manifest.json・archive.db と同梱ファイル（答案・模範解答の画像
 *   など）で、答案は1試験で多くて数千枚（400人 × 4ページで 1,600）。数百の試験をまとめても
 *   収まる
 * - 1項目: 2GiB。`read` は1項目をまるごとメモリに載せる。画像は1枚で数 MB、archive.db は
 *   画像を含まない（行だけ）ので、正当なものは遠く及ばない
 * - 合計: 256GiB。画像はほぼ縮まないので、伸張後の合計はおおよそ .sao の大きさになる。
 *   答案の画像は1試験で数 GB になりうるので、何年分もの試験をまとめても収まる大きさにする。
 *   実際に書けるかは、展開の前に空きと比べる（`archiveOpener.ts`）
 * - 縮み方: 200 倍（1 MiB を超えるものだけ）。画像（PNG・JPEG）はほぼ縮まず、archive.db は
 *   書き出しで VACUUM してあり、行の文字が縮むだけなので数倍〜数十倍に収まる。deflate が
 *   縮められる限りは約 1,000 倍で、それに近いものは中身が同じバイトの繰り返しの作り物
 */
export const DEFAULT_ARCHIVE_ZIP_LIMITS: ArchiveZipLimits = {
  maxEntries: 1_000_000,
  maxEntryUncompressedBytes: 2 * GIBIBYTE,
  maxTotalUncompressedBytes: 256 * GIBIBYTE,
  maxCompressionRatio: 200,
  compressionRatioExemptBytes: MEBIBYTE,
}

/** 上限を確かめる項目の大きさ */
export interface ArchiveZipEntrySizes {
  readonly name: string
  readonly compressedSize: number
  readonly uncompressedSize: number
}

/** バイト数を人に見せる形にする（MB・GB） */
export function formatByteSize(bytes: number): string {
  if (bytes >= GIBIBYTE) return `${(bytes / GIBIBYTE).toFixed(1)}GB`
  return `${Math.ceil(bytes / MEBIBYTE)}MB`
}

/** 圧縮後の大きさに比べて伸張後が大きすぎるか（小さいものは問わない） */
const exceedsCompressionRatio = (
  sizes: { compressedSize: number; uncompressedSize: number },
  limits: ArchiveZipLimits
): boolean =>
  sizes.uncompressedSize > limits.compressionRatioExemptBytes &&
  sizes.uncompressedSize > sizes.compressedSize * limits.maxCompressionRatio

/**
 * 項目の大きさを上限と照らし、超えていれば理由を返す（収まれば null）。
 * 新しい形式（このファイル）と旧形式（adm-zip で読む `legacyZipLimits.ts`）で同じ規則を使う
 */
export function describeZipLimitViolation(
  entries: readonly ArchiveZipEntrySizes[],
  limits: ArchiveZipLimits
): string | null {
  if (entries.length > limits.maxEntries) {
    return `項目の数が上限（${limits.maxEntries}）を超えている`
  }
  let totalCompressedBytes = 0
  let totalUncompressedBytes = 0
  for (const entry of entries) {
    if (entry.uncompressedSize > limits.maxEntryUncompressedBytes) {
      return `${entry.name}: 伸張後の大きさが上限（${formatByteSize(limits.maxEntryUncompressedBytes)}）を超えている`
    }
    if (exceedsCompressionRatio(entry, limits)) {
      return `${entry.name}: 圧縮後の大きさに比べて、伸張後が大きすぎる`
    }
    totalCompressedBytes += entry.compressedSize
    totalUncompressedBytes += entry.uncompressedSize
  }
  if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
    return `伸張後の大きさの合計が上限（${formatByteSize(limits.maxTotalUncompressedBytes)}）を超えている`
  }
  if (
    exceedsCompressionRatio(
      {
        compressedSize: totalCompressedBytes,
        uncompressedSize: totalUncompressedBytes,
      },
      limits
    )
  ) {
    return "圧縮後の大きさに比べて、伸張後の合計が大きすぎる"
  }
  return null
}

/** 中央ディレクトリの項目1つ */
export interface ArchiveZipEntry {
  /** ZIP の中の名前（区切りは "/"。ディレクトリの項目は末尾が "/"） */
  readonly name: string
  readonly isDirectory: boolean
  /** 中央ディレクトリに記録された、伸張後の大きさ（`read` はこれと合わなければ断る） */
  readonly uncompressedSize: number
  readonly compressedSize: number
  /** 伸張し、CRC と大きさを確かめた中身。合わなければ `ArchiveZipFormatError` */
  readonly read: () => Promise<Uint8Array>
}

/** 開いた ZIP。読み終えたら `close` する */
export interface ArchiveZip {
  readonly entries: readonly ArchiveZipEntry[]
  /** 全項目の伸張後の大きさの合計（記録の値。展開の前に空きと比べる） */
  readonly totalUncompressedBytes: number
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

/** 中央ディレクトリから読んだ項目1つ（中身を読む前の記録） */
interface CentralDirectoryRecord {
  readonly name: string
  readonly nameLength: number
  readonly compression: number
  readonly expectedCrc: number
  readonly compressedSize: number
  readonly uncompressedSize: number
  /** ローカルヘッダーの位置 */
  readonly localHeaderOffset: number
}

/**
 * 項目のデータの範囲（ローカルヘッダーから圧縮データの終わりまで）が互いに重ならず、
 * 中央ディレクトリより前にあることを確かめ、項目ごとに「データが越えてはいけない位置」
 * （次の項目の始まりか、中央ディレクトリの始まり）を返す。
 *
 * ここでは中央ディレクトリの名前の長さで範囲の下限を見積もる（ローカルヘッダーの拡張欄の
 * 長さは読むまで分からない）。実際の終わりは `read` でローカルヘッダーを読んでから、返した
 * 位置を越えないことを確かめる
 */
const dataLimitsOf = (
  records: readonly CentralDirectoryRecord[],
  centralDirectoryOffset: number
): Map<CentralDirectoryRecord, number> => {
  const byOffset = [...records].sort(
    (left, right) => left.localHeaderOffset - right.localHeaderOffset
  )
  const dataLimits = new Map<CentralDirectoryRecord, number>()
  byOffset.forEach((record, recordIndex) => {
    const nextStart =
      byOffset[recordIndex + 1]?.localHeaderOffset ?? centralDirectoryOffset
    const minimumEnd =
      record.localHeaderOffset +
      LOCAL_FILE_HEADER_SIZE +
      record.nameLength +
      record.compressedSize
    if (minimumEnd > nextStart) {
      throw new ArchiveZipFormatError(
        `${record.name}: 項目のデータが、他の項目か中央ディレクトリと重なっている`
      )
    }
    dataLimits.set(record, nextStart)
  })
  return dataLimits
}

/** 中央ディレクトリから項目の一覧を読む */
const readCentralDirectory = async (
  zipFile: ZipFile,
  limits: ArchiveZipLimits
): Promise<ArchiveZipEntry[]> => {
  const centralDirectory = await locateCentralDirectory(zipFile)
  // 中央ディレクトリを読む前に、記録された項目の数で断る
  if (centralDirectory.entryCount > limits.maxEntries) {
    throw new ArchiveZipLimitError(
      `項目の数が上限（${limits.maxEntries}）を超えている`
    )
  }
  const zip = await zipFile.read(
    centralDirectory.offset,
    centralDirectory.size,
    "中央ディレクトリ"
  )
  const records: CentralDirectoryRecord[] = []
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
    records.push({
      name,
      nameLength,
      compression,
      expectedCrc,
      compressedSize: sizes.compressedSize,
      uncompressedSize: sizes.uncompressedSize,
      localHeaderOffset: sizes.offset,
    })
  }

  // 伸ばす前に、記録された大きさを上限と照らす
  const violation = describeZipLimitViolation(records, limits)
  if (violation !== null) throw new ArchiveZipLimitError(violation)
  const dataLimits = dataLimitsOf(records, centralDirectory.offset)

  return records.map((record): ArchiveZipEntry => {
    const { name, compressedSize, uncompressedSize } = record
    return {
      name,
      isDirectory: name.endsWith("/"),
      uncompressedSize,
      compressedSize,
      read: async () => {
        const dataOffset = await dataOffsetOf(zipFile, record.localHeaderOffset)
        const dataLimit = dataLimits.get(record) ?? centralDirectory.offset
        if (dataOffset + compressedSize > dataLimit) {
          throw new ArchiveZipFormatError(
            `${name}: 項目のデータが、他の項目か中央ディレクトリと重なっている`
          )
        }
        const compressed = (
          await zipFile.read(dataOffset, compressedSize, `${name} の中身`)
        ).bytes
        const content = decompress(
          name,
          compressed,
          record.compression,
          uncompressedSize
        )
        if (content.byteLength !== uncompressedSize) {
          throw new ArchiveZipFormatError(`${name}: 大きさが記録と合わない`)
        }
        if (crc32Of(content) !== record.expectedCrc) {
          throw new ArchiveZipFormatError(`${name}: CRC が合わない`)
        }
        return content
      },
    }
  })
}

/**
 * ZIP のファイルを開き、項目の一覧を読む。ZIP として読めなければ `ArchiveZipFormatError`、
 * 大きさの上限を超えれば `ArchiveZipLimitError`（開けなければ fs の例外）。中身は返した項目の
 * `read` で取り出し、終わったら `close` する
 */
export async function openArchiveZip(
  filePath: string,
  limits: ArchiveZipLimits = DEFAULT_ARCHIVE_ZIP_LIMITS
): Promise<ArchiveZip> {
  const fileHandle = await fsPromises.open(filePath, "r")
  try {
    const entries = await readCentralDirectory(
      await openZipFile(fileHandle),
      limits
    )
    const totalUncompressedBytes = entries.reduce(
      (total, entry) => total + entry.uncompressedSize,
      0
    )
    return {
      entries,
      totalUncompressedBytes,
      close: () => fileHandle.close(),
    }
  } catch (error) {
    await fileHandle.close()
    throw error
  }
}
