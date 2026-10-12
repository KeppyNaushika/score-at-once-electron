/**
 * 統合アーカイブ（.sao）の ZIP を書く
 *
 * デスクトップ版と web 版で同じコードを使う（Node 専用のモジュールを使わない。圧縮は fflate、
 * 書き込みは `fs/promises` の FileHandle。web 版は `web/worker/opfsFs.ts` の FileHandle）。
 * 項目を1つずつ足し、出来た ZIP のバイト列はある程度溜まるごとにファイルへ書き足すので、
 * 全体をメモリに持たない。
 *
 * ZIP の入れ物（ヘッダー・中央ディレクトリ）はここで書く。4GB を超える大きさ・位置と、65535 を
 * 超える項目の数は ZIP64 で書く（答案の画像の多い試験をまとめると 4GB に届きうる）。ZIP64 に
 * するのは収まらない欄を持つ項目と終わりの記録だけで、収まるものは普通の ZIP のまま書く
 * （archiver と同じ。古い展開ツールでも、4GB に届かないアーカイブは今まで通り読める）。
 * 中身の大きさは足す時点で分かっているので、データ記述子は使わない。
 */

import { deflateSync } from "fflate"
import * as fsPromises from "fs/promises"

import { crc32Of } from "./archiveZipCrc32"

/** 溜まった ZIP のバイト列を、ファイルへ足す目安 */
const FLUSH_THRESHOLD_BYTES = 16 * 1024 * 1024

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50

const ZIP64_EXTRA_FIELD_ID = 0x0001
/** 32ビット・16ビットの欄に入れる「本当の値は ZIP64 の欄にある」印 */
const ZIP64_MARKER_32 = 0xffffffff
const ZIP64_MARKER_16 = 0xffff

/** 展開に要る版: 2.0（deflate）と 4.5（ZIP64） */
const VERSION_DEFLATE = 20
const VERSION_ZIP64 = 45
/** 作った環境（上位バイト 3 = UNIX）と版。外部属性に UNIX の権限を入れる */
const VERSION_MADE_BY = (3 << 8) | VERSION_ZIP64
const REGULAR_FILE_ATTRIBUTES = (0o100644 << 16) >>> 0
/** 名前は UTF-8 */
const UTF8_NAME_FLAG = 0x0800
const COMPRESSION_STORED = 0
const COMPRESSION_DEFLATE = 8

/** 普通の ZIP で書ける上限（これ以上は ZIP64） */
export interface Zip32Limits {
  /** 大きさ・位置の欄。この値以上は ZIP64 */
  readonly bytes: number
  /** 項目の数。この値以上は ZIP64 */
  readonly entries: number
}

const DEFAULT_ZIP32_LIMITS: Zip32Limits = {
  bytes: ZIP64_MARKER_32,
  entries: ZIP64_MARKER_16,
}

/** 項目の入れ方。既に圧縮された画像は縮まないので、そのまま入れる */
export type ArchiveZipCompression = "deflate" | "store"

export interface ArchiveZipWriter {
  add: (
    name: string,
    content: Uint8Array,
    compression: ArchiveZipCompression
  ) => Promise<void>
  /** 中央ディレクトリを書いて閉じる */
  finish: () => Promise<void>
  /** 書きかけのまま閉じる（失敗したとき。ファイルを消すのは呼び出し側） */
  discard: () => Promise<void>
}

interface ArchiveZipWriterOptions {
  /** テスト用。ZIP64 にする境目を下げ、4GB を書かずに ZIP64 の経路を通す */
  zip32Limits?: Zip32Limits
  /** テスト用。項目の時刻（既定は足した時点） */
  now?: () => Date
}

/** 中央ディレクトリに載せる、書き終えた項目1つ */
interface WrittenEntry {
  readonly nameBytes: Uint8Array
  readonly compression: number
  readonly crc: number
  readonly compressedSize: number
  readonly uncompressedSize: number
  readonly localHeaderOffset: number
  readonly dosTime: number
  readonly dosDate: number
}

/** 小さな器に、リトルエンディアンで順に書く */
class ByteWriter {
  readonly bytes: Uint8Array
  private readonly view: DataView
  private offset = 0

  constructor(length: number) {
    this.bytes = new Uint8Array(length)
    this.view = new DataView(this.bytes.buffer)
  }

  uint16(value: number): this {
    this.view.setUint16(this.offset, value, true)
    this.offset += 2
    return this
  }

  uint32(value: number): this {
    this.view.setUint32(this.offset, value >>> 0, true)
    this.offset += 4
    return this
  }

  uint64(value: number): this {
    this.view.setBigUint64(this.offset, BigInt(value), true)
    this.offset += 8
    return this
  }

  bytesOf(content: Uint8Array): this {
    this.bytes.set(content, this.offset)
    this.offset += content.byteLength
    return this
  }
}

/** ZIP の時刻（DOS 形式。1980 年より前は 1980-01-01 にする） */
const toDosDateTime = (date: Date): { dosTime: number; dosDate: number } => {
  const year = Math.max(date.getFullYear(), 1980)
  return {
    dosTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** ZIP64 の拡張欄（値を並べたもの。空なら欄そのものを書かない） */
const zip64ExtraField = (values: readonly number[]): Uint8Array => {
  if (values.length === 0) return new Uint8Array(0)
  const writer = new ByteWriter(4 + values.length * 8)
    .uint16(ZIP64_EXTRA_FIELD_ID)
    .uint16(values.length * 8)
  values.forEach((value) => writer.uint64(value))
  return writer.bytes
}

/**
 * `outputPath` を新しく作って開き（既にあれば EEXIST で失敗し、触らない）、そこへ書く口を返す。
 * 途中で失敗したら `discard` で閉じる。作りかけを消すのは呼び出し側
 */
export async function createArchiveZipWriter(
  outputPath: string,
  options: ArchiveZipWriterOptions = {}
): Promise<ArchiveZipWriter> {
  const limits = options.zip32Limits ?? DEFAULT_ZIP32_LIMITS
  const now = options.now ?? (() => new Date())
  const exceedsZip32 = (value: number): boolean => value >= limits.bytes
  const nameEncoder = new TextEncoder()

  const fileHandle = await fsPromises.open(outputPath, "wx")

  const writtenEntries: WrittenEntry[] = []
  let pendingChunks: Uint8Array[] = []
  let pendingBytes = 0
  /** ファイルへ書いた長さ */
  let writtenBytes = 0
  /** ファイルの先頭からの、次に書く位置（ファイルへ書いたもの + 溜まっているもの） */
  let nextOffset = 0

  const append = (chunk: Uint8Array): void => {
    pendingChunks.push(chunk)
    pendingBytes += chunk.byteLength
    nextOffset += chunk.byteLength
  }

  const flush = async (force: boolean): Promise<void> => {
    if (pendingBytes === 0) return
    if (!force && pendingBytes < FLUSH_THRESHOLD_BYTES) return
    const chunks = pendingChunks
    const chunkBytes = pendingBytes
    pendingChunks = []
    pendingBytes = 0
    const joined = Buffer.concat(chunks, chunkBytes)
    let joinedWritten = 0
    while (joinedWritten < joined.byteLength) {
      const { bytesWritten } = await fileHandle.write(
        joined,
        joinedWritten,
        joined.byteLength - joinedWritten,
        writtenBytes + joinedWritten
      )
      joinedWritten += bytesWritten
    }
    writtenBytes += joined.byteLength
  }

  const writeLocalHeader = (entry: WrittenEntry): void => {
    // ローカルヘッダーの ZIP64 の欄は、伸張後と圧縮後の大きさを両方持つ（片方だけは不可）
    const sizesNeedZip64 =
      exceedsZip32(entry.uncompressedSize) || exceedsZip32(entry.compressedSize)
    const extra = zip64ExtraField(
      sizesNeedZip64 ? [entry.uncompressedSize, entry.compressedSize] : []
    )
    append(
      new ByteWriter(30 + entry.nameBytes.byteLength + extra.byteLength)
        .uint32(LOCAL_FILE_HEADER_SIGNATURE)
        .uint16(sizesNeedZip64 ? VERSION_ZIP64 : VERSION_DEFLATE)
        .uint16(UTF8_NAME_FLAG)
        .uint16(entry.compression)
        .uint16(entry.dosTime)
        .uint16(entry.dosDate)
        .uint32(entry.crc)
        .uint32(sizesNeedZip64 ? ZIP64_MARKER_32 : entry.compressedSize)
        .uint32(sizesNeedZip64 ? ZIP64_MARKER_32 : entry.uncompressedSize)
        .uint16(entry.nameBytes.byteLength)
        .uint16(extra.byteLength)
        .bytesOf(entry.nameBytes)
        .bytesOf(extra).bytes
    )
  }

  const centralDirectoryHeaderOf = (entry: WrittenEntry): Uint8Array => {
    // 中央ディレクトリの ZIP64 の欄は、収まらない欄だけをこの順に持つ
    const uncompressedNeedsZip64 = exceedsZip32(entry.uncompressedSize)
    const compressedNeedsZip64 = exceedsZip32(entry.compressedSize)
    const offsetNeedsZip64 = exceedsZip32(entry.localHeaderOffset)
    const extra = zip64ExtraField([
      ...(uncompressedNeedsZip64 ? [entry.uncompressedSize] : []),
      ...(compressedNeedsZip64 ? [entry.compressedSize] : []),
      ...(offsetNeedsZip64 ? [entry.localHeaderOffset] : []),
    ])
    return new ByteWriter(46 + entry.nameBytes.byteLength + extra.byteLength)
      .uint32(CENTRAL_DIRECTORY_HEADER_SIGNATURE)
      .uint16(VERSION_MADE_BY)
      .uint16(extra.byteLength > 0 ? VERSION_ZIP64 : VERSION_DEFLATE)
      .uint16(UTF8_NAME_FLAG)
      .uint16(entry.compression)
      .uint16(entry.dosTime)
      .uint16(entry.dosDate)
      .uint32(entry.crc)
      .uint32(compressedNeedsZip64 ? ZIP64_MARKER_32 : entry.compressedSize)
      .uint32(uncompressedNeedsZip64 ? ZIP64_MARKER_32 : entry.uncompressedSize)
      .uint16(entry.nameBytes.byteLength)
      .uint16(extra.byteLength)
      .uint16(0) // 注釈の長さ
      .uint16(0) // 開始ディスク
      .uint16(0) // 内部属性
      .uint32(REGULAR_FILE_ATTRIBUTES)
      .uint32(offsetNeedsZip64 ? ZIP64_MARKER_32 : entry.localHeaderOffset)
      .bytesOf(entry.nameBytes)
      .bytesOf(extra).bytes
  }

  /** 中央ディレクトリの後ろの終わりの記録。収まらない欄があれば ZIP64 の記録と位置の記録を前に置く */
  const writeEndRecords = (
    centralDirectoryOffset: number,
    centralDirectorySize: number
  ): void => {
    const entryCount = writtenEntries.length
    const needsZip64 =
      entryCount >= limits.entries ||
      exceedsZip32(centralDirectoryOffset) ||
      exceedsZip32(centralDirectorySize)
    if (needsZip64) {
      const zip64EndOffset = nextOffset
      append(
        new ByteWriter(56)
          .uint32(ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE)
          .uint64(44) // この記録の残りの長さ
          .uint16(VERSION_MADE_BY)
          .uint16(VERSION_ZIP64)
          .uint32(0) // このディスクの番号
          .uint32(0) // 中央ディレクトリの始まるディスク
          .uint64(entryCount)
          .uint64(entryCount)
          .uint64(centralDirectorySize)
          .uint64(centralDirectoryOffset).bytes
      )
      append(
        new ByteWriter(20)
          .uint32(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE)
          .uint32(0) // ZIP64 の終わりの記録があるディスク
          .uint64(zip64EndOffset)
          .uint32(1).bytes // ディスクの数
      )
    }
    const countField = needsZip64 ? ZIP64_MARKER_16 : entryCount
    append(
      new ByteWriter(22)
        .uint32(END_OF_CENTRAL_DIRECTORY_SIGNATURE)
        .uint16(0) // このディスクの番号
        .uint16(0) // 中央ディレクトリの始まるディスク
        .uint16(countField)
        .uint16(countField)
        .uint32(needsZip64 ? ZIP64_MARKER_32 : centralDirectorySize)
        .uint32(needsZip64 ? ZIP64_MARKER_32 : centralDirectoryOffset)
        .uint16(0).bytes // 注釈の長さ
    )
  }

  return {
    add: async (name, content, compression) => {
      const stored = compression === "store"
      const data = stored ? content : deflateSync(content, { level: 9 })
      const entry: WrittenEntry = {
        nameBytes: nameEncoder.encode(name),
        compression: stored ? COMPRESSION_STORED : COMPRESSION_DEFLATE,
        crc: crc32Of(content),
        compressedSize: data.byteLength,
        uncompressedSize: content.byteLength,
        localHeaderOffset: nextOffset,
        ...toDosDateTime(now()),
      }
      writeLocalHeader(entry)
      append(data)
      writtenEntries.push(entry)
      await flush(false)
    },
    finish: async () => {
      const centralDirectoryOffset = nextOffset
      writtenEntries.forEach((entry) => append(centralDirectoryHeaderOf(entry)))
      writeEndRecords(
        centralDirectoryOffset,
        nextOffset - centralDirectoryOffset
      )
      await flush(true)
      await fileHandle.close()
    },
    discard: () => fileHandle.close(),
  }
}
