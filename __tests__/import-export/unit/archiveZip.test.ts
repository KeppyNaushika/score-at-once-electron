/**
 * 統合アーカイブ（.sao）の ZIP の読み書き
 *
 * テスト対象:
 * - electron-src/lib/export/unified-archive/archiveZipWriter.ts
 * - electron-src/lib/import/unified-archive/archiveZipReader.ts
 *
 * 読み書きはデスクトップ版と web 版で共通（fflate）。書いた道具によらず読めること
 * （adm-zip が書いたもの・データ記述子つきの無圧縮の項目）と、壊れたものを読み違えずに断ることを見る。
 * 旧版のデスクトップ版（archiver）が書いた .sao は、archiver を外す前に読めることを確かめた
 * （データ記述子・ZIP64 を含む）。
 *
 * ZIP64 は、境目（`zip32Limits`）を下げて 4GB を書かずに経路を通す。実際に 4GB を超える
 * アーカイブは、一度だけ書いて `unzip -t` で検査した（テストには置かない）。
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  createArchiveZipWriter,
  type Zip32Limits,
} from "../../../electron-src/lib/export/unified-archive/archiveZipWriter"
import {
  type ArchiveZip,
  ArchiveZipFormatError,
  ArchiveZipLimitError,
  type ArchiveZipLimits,
  DEFAULT_ARCHIVE_ZIP_LIMITS,
  describeZipLimitViolation,
  openArchiveZip,
} from "../../../electron-src/lib/import/unified-archive/archiveZipReader"

const WORK_DIR = path.join(os.tmpdir(), "archive-zip")
const OUTPUT_PATH = path.join(WORK_DIR, "書き出し.sao")

const MANIFEST_TEXT = JSON.stringify({ format: "テスト" })
/** 縮む中身（deflate で入れる） */
const DATABASE_BYTES = Buffer.from("SQLite format 3\0".repeat(4096))
/** 縮まない中身（そのまま入れる） */
const IMAGE_BYTES = Buffer.from(
  Array.from({ length: 70_000 }, (_unused, byteIndex) => (byteIndex * 31) % 251)
)
const IMAGE_NAME = "files/answers/生徒の答案.png"

const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR = Buffer.from([
  0x50, 0x4b, 0x06, 0x07,
])

const writeSampleArchive = async (zip32Limits?: Zip32Limits): Promise<void> => {
  const writer = await createArchiveZipWriter(OUTPUT_PATH, { zip32Limits })
  await writer.add("manifest.json", Buffer.from(MANIFEST_TEXT), "deflate")
  await writer.add("archive.db", DATABASE_BYTES, "deflate")
  await writer.add(IMAGE_NAME, IMAGE_BYTES, "store")
  await writer.finish()
}

/** 開いた ZIP（各テストの後で閉じる） */
const openedZips: ArchiveZip[] = []

/** バイト列をファイルに置いて開き、項目の一覧を返す */
const readArchiveZipEntries = async (zipBytes: Uint8Array) => {
  const zipPath = path.join(WORK_DIR, `${openedZips.length}-読む.zip`)
  fs.writeFileSync(zipPath, zipBytes)
  const archiveZip = await openArchiveZip(zipPath)
  openedZips.push(archiveZip)
  return archiveZip.entries
}

describe("統合アーカイブの ZIP", () => {
  afterEach(async () => {
    await Promise.all(openedZips.map((archiveZip) => archiveZip.close()))
    openedZips.length = 0
  })

  beforeEach(() => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(WORK_DIR, { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
  })

  it("書いたものを読むと、名前と中身が戻る（日本語の名前・無圧縮・deflate）", async () => {
    await writeSampleArchive()

    const entries = await readArchiveZipEntries(fs.readFileSync(OUTPUT_PATH))
    expect(entries.map((entry) => entry.name)).toEqual([
      "manifest.json",
      "archive.db",
      IMAGE_NAME,
    ])
    expect(entries.every((entry) => !entry.isDirectory)).toBe(true)
    expect(Buffer.from(await entries[0].read()).toString("utf8")).toBe(
      MANIFEST_TEXT
    )
    expect(Buffer.from(await entries[1].read()).equals(DATABASE_BYTES)).toBe(
      true
    )
    expect(Buffer.from(await entries[2].read()).equals(IMAGE_BYTES)).toBe(true)
  })

  it("書いたものは別の道具（adm-zip）でも読める", async () => {
    await writeSampleArchive()

    const zip = new AdmZip(OUTPUT_PATH)
    expect(zip.getEntry("archive.db")?.getData().equals(DATABASE_BYTES)).toBe(
      true
    )
    expect(zip.getEntry(IMAGE_NAME)?.getData().equals(IMAGE_BYTES)).toBe(true)
  })

  it("別の道具（adm-zip）が書いたものも読め、ディレクトリの項目を見分ける", async () => {
    const zip = new AdmZip()
    zip.addFile("files/", Buffer.alloc(0))
    zip.addFile(IMAGE_NAME, IMAGE_BYTES)
    zip.addFile("archive.db", DATABASE_BYTES)

    const entriesByName = new Map(
      (await readArchiveZipEntries(zip.toBuffer())).map((entry) => [
        entry.name,
        entry,
      ])
    )
    expect(
      [...entriesByName.values()]
        .map((entry) => [entry.name, entry.isDirectory])
        .sort()
    ).toEqual([
      ["archive.db", false],
      ["files/", true],
      [IMAGE_NAME, false],
    ])
    const imageEntry = entriesByName.get(IMAGE_NAME)
    const databaseEntry = entriesByName.get("archive.db")
    expect(
      imageEntry && Buffer.from(await imageEntry.read()).equals(IMAGE_BYTES)
    ).toBe(true)
    expect(
      databaseEntry &&
        Buffer.from(await databaseEntry.read()).equals(DATABASE_BYTES)
    ).toBe(true)
  })

  it("書き出し先が既にあれば、書かずに失敗し、元のファイルに触らない", async () => {
    fs.writeFileSync(OUTPUT_PATH, "元のファイル")

    await expect(createArchiveZipWriter(OUTPUT_PATH)).rejects.toMatchObject({
      code: "EEXIST",
    })
    expect(fs.readFileSync(OUTPUT_PATH, "utf8")).toBe("元のファイル")
  })

  it("中身が1バイトでも壊れていれば、CRC で断る", async () => {
    await writeSampleArchive()
    const zipBytes = fs.readFileSync(OUTPUT_PATH)
    const imageOffset = zipBytes.indexOf(IMAGE_BYTES.subarray(0, 64))
    zipBytes[imageOffset + 100] ^= 0xff

    const entries = await readArchiveZipEntries(zipBytes)
    await expect(entries[2].read()).rejects.toThrow(ArchiveZipFormatError)
    await expect(entries[2].read()).rejects.toThrow(/CRC/)
  })

  it("ZIP でないもの・途中で切れたものは ArchiveZipFormatError で断る", async () => {
    await expect(
      readArchiveZipEntries(Buffer.from("ZIP ではない"))
    ).rejects.toThrow(ArchiveZipFormatError)
    await writeSampleArchive()
    const zipBytes = fs.readFileSync(OUTPUT_PATH)
    await expect(
      readArchiveZipEntries(zipBytes.subarray(0, zipBytes.length - 30))
    ).rejects.toThrow(ArchiveZipFormatError)
  })

  it("4GB に届かないアーカイブは普通の ZIP のまま書く（ZIP64 の記録を持たない）", async () => {
    await writeSampleArchive()

    expect(
      fs
        .readFileSync(OUTPUT_PATH)
        .includes(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR)
    ).toBe(false)
  })

  it("大きさ・位置・項目の数が収まらなければ ZIP64 で書き、自作の読み手でも adm-zip でも読める", async () => {
    // 1バイト以上の大きさ・位置と、1つ以上の項目を「収まらない」とみなす
    await writeSampleArchive({ bytes: 1, entries: 1 })
    const zipBytes = fs.readFileSync(OUTPUT_PATH)
    expect(zipBytes.includes(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR)).toBe(true)

    const entries = await readArchiveZipEntries(zipBytes)
    expect(entries.map((entry) => entry.name)).toEqual([
      "manifest.json",
      "archive.db",
      IMAGE_NAME,
    ])
    expect(Buffer.from(await entries[0].read()).toString("utf8")).toBe(
      MANIFEST_TEXT
    )
    expect(Buffer.from(await entries[1].read()).equals(DATABASE_BYTES)).toBe(
      true
    )
    expect(Buffer.from(await entries[2].read()).equals(IMAGE_BYTES)).toBe(true)

    const zip = new AdmZip(OUTPUT_PATH)
    expect(zip.getEntry("manifest.json")?.getData().toString("utf8")).toBe(
      MANIFEST_TEXT
    )
    expect(zip.getEntry("archive.db")?.getData().equals(DATABASE_BYTES)).toBe(
      true
    )
    expect(zip.getEntry(IMAGE_NAME)?.getData().equals(IMAGE_BYTES)).toBe(true)
  })

  it("項目の数だけが収まらないときも、ZIP64 の終わりの記録で数を持つ", async () => {
    await writeSampleArchive({ bytes: 0xffffffff, entries: 2 })
    const zipBytes = fs.readFileSync(OUTPUT_PATH)
    expect(zipBytes.includes(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR)).toBe(true)

    expect(await readArchiveZipEntries(zipBytes)).toHaveLength(3)
    expect(new AdmZip(OUTPUT_PATH).getEntries()).toHaveLength(3)
  })
})

describe("統合アーカイブの ZIP の大きさの上限と、項目の重なり", () => {
  afterEach(async () => {
    await Promise.all(openedZips.map((archiveZip) => archiveZip.close()))
    openedZips.length = 0
  })

  beforeEach(() => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(WORK_DIR, { recursive: true })
  })

  /** 上限を差し替えて開く（大きなファイルを作らずに、上限の手前と先を確かめる） */
  const openWithLimits = async (
    zipBytes: Uint8Array,
    limits: Partial<ArchiveZipLimits>
  ): Promise<ArchiveZip> => {
    const zipPath = path.join(WORK_DIR, `${openedZips.length}-上限.zip`)
    fs.writeFileSync(zipPath, zipBytes)
    const archiveZip = await openArchiveZip(zipPath, {
      ...DEFAULT_ARCHIVE_ZIP_LIMITS,
      ...limits,
    })
    openedZips.push(archiveZip)
    return archiveZip
  }

  const sampleBytes = async (): Promise<Buffer> => {
    await writeSampleArchive()
    return fs.readFileSync(OUTPUT_PATH)
  }

  /** 中央ディレクトリの項目の位置（書いた順） */
  const centralDirectoryHeaderOffsets = (zipBytes: Buffer): number[] => {
    const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02])
    const offsets: number[] = []
    let searchFrom = 0
    for (;;) {
      const found = zipBytes.indexOf(signature, searchFrom)
      if (found < 0) return offsets
      offsets.push(found)
      searchFrom = found + signature.length
    }
  }

  it("既定の上限なら、書き出しが作ったものは今までどおり開け、伸張後の合計を返す", async () => {
    const archiveZip = await openWithLimits(await sampleBytes(), {})
    expect(archiveZip.entries.map((entry) => entry.uncompressedSize)).toEqual([
      Buffer.byteLength(MANIFEST_TEXT),
      DATABASE_BYTES.length,
      IMAGE_BYTES.length,
    ])
    expect(archiveZip.totalUncompressedBytes).toBe(
      Buffer.byteLength(MANIFEST_TEXT) +
        DATABASE_BYTES.length +
        IMAGE_BYTES.length
    )
    expect(Buffer.from(await archiveZip.entries[1].read())).toEqual(
      DATABASE_BYTES
    )
  })

  it("上限ちょうどなら開ける", async () => {
    const total =
      Buffer.byteLength(MANIFEST_TEXT) +
      DATABASE_BYTES.length +
      IMAGE_BYTES.length
    const archiveZip = await openWithLimits(await sampleBytes(), {
      maxEntries: 3,
      maxEntryUncompressedBytes: IMAGE_BYTES.length,
      maxTotalUncompressedBytes: total,
    })
    expect(archiveZip.entries).toHaveLength(3)
  })

  it("項目の数が上限を超えれば ArchiveZipLimitError で断る", async () => {
    await expect(
      openWithLimits(await sampleBytes(), { maxEntries: 2 })
    ).rejects.toThrow(ArchiveZipLimitError)
  })

  it("1項目の伸張後の大きさが上限を超えれば ArchiveZipLimitError で断る", async () => {
    await expect(
      openWithLimits(await sampleBytes(), {
        maxEntryUncompressedBytes: IMAGE_BYTES.length - 1,
      })
    ).rejects.toThrow(ArchiveZipLimitError)
  })

  it("伸張後の合計が上限を超えれば ArchiveZipLimitError で断る", async () => {
    await expect(
      openWithLimits(await sampleBytes(), {
        maxTotalUncompressedBytes: DATABASE_BYTES.length + IMAGE_BYTES.length,
      })
    ).rejects.toThrow(ArchiveZipLimitError)
  })

  it("縮み方が上限を超える項目は ArchiveZipLimitError で断る（縮まない画像は通る）", async () => {
    const zipBytes = await sampleBytes()
    // 同じバイトの繰り返しの archive.db は2倍より大きく縮む
    await expect(
      openWithLimits(zipBytes, {
        maxCompressionRatio: 2,
        compressionRatioExemptBytes: 1024,
      })
    ).rejects.toThrow(/archive\.db/)
    // 小さいものは縮み方を問わない
    const archiveZip = await openWithLimits(zipBytes, {
      maxCompressionRatio: 2,
      compressionRatioExemptBytes: DATABASE_BYTES.length,
    })
    expect(archiveZip.entries).toHaveLength(3)
  })

  it("2つの項目が同じデータを指していれば ArchiveZipFormatError で断る", async () => {
    const zipBytes = await sampleBytes()
    const [manifestHeader, databaseHeader] =
      centralDirectoryHeaderOffsets(zipBytes)
    // archive.db の項目の位置を、manifest.json の項目の位置に書き換える
    zipBytes.writeUInt32LE(
      zipBytes.readUInt32LE(manifestHeader + 42),
      databaseHeader + 42
    )
    await expect(openWithLimits(zipBytes, {})).rejects.toThrow(
      ArchiveZipFormatError
    )
    await expect(openWithLimits(zipBytes, {})).rejects.toThrow(/重なっている/)
  })

  it("項目のデータが中央ディレクトリまで延びていれば ArchiveZipFormatError で断る", async () => {
    const zipBytes = await sampleBytes()
    const imageHeader = centralDirectoryHeaderOffsets(zipBytes)[2]
    // 無圧縮の画像の大きさ（圧縮後・伸張後）を、中央ディレクトリに届くまで延ばす
    const enlargedSize = zipBytes.readUInt32LE(imageHeader + 20) + 64
    zipBytes.writeUInt32LE(enlargedSize, imageHeader + 20)
    zipBytes.writeUInt32LE(enlargedSize, imageHeader + 24)
    await expect(openWithLimits(zipBytes, {})).rejects.toThrow(/重なっている/)
  })

  it("上限の規則: 小さい項目は縮み方を問わず、全体の縮み方も見る", () => {
    const limits: ArchiveZipLimits = {
      maxEntries: 10,
      maxEntryUncompressedBytes: 1000,
      maxTotalUncompressedBytes: 5000,
      maxCompressionRatio: 10,
      compressionRatioExemptBytes: 100,
    }
    const smallButHighlyCompressed = {
      name: "files/a.png",
      compressedSize: 1,
      uncompressedSize: 100,
    }
    expect(
      describeZipLimitViolation([smallButHighlyCompressed], limits)
    ).toBeNull()
    // 1つずつは小さくても、合計の縮み方が上限を超える
    expect(
      describeZipLimitViolation(
        Array.from({ length: 5 }, () => smallButHighlyCompressed),
        limits
      )
    ).toMatch(/合計/)
    expect(
      describeZipLimitViolation(
        [{ name: "archive.db", compressedSize: 100, uncompressedSize: 1000 }],
        limits
      )
    ).toBeNull()
  })
})
