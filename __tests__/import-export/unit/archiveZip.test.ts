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
