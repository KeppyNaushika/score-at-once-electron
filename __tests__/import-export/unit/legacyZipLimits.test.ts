/**
 * 旧形式のアーカイブ（adm-zip で読む）の大きさの上限
 *
 * テスト対象: electron-src/lib/import/shared/legacyZipLimits.ts
 *
 * 規則は統合アーカイブ（`archiveZipReader.ts` の `describeZipLimitViolation`）と同じ。
 * 上限を小さく差し替えて、大きなファイルを作らずに確かめる。
 */

import AdmZip from "adm-zip"
import { describe, expect, it } from "vitest"

import { assertLegacyZipWithinLimits } from "../../../electron-src/lib/import/shared/legacyZipLimits"
import {
  type ArchiveZipLimits,
  DEFAULT_ARCHIVE_ZIP_LIMITS,
} from "../../../electron-src/lib/import/unified-archive/archiveZipReader"

/** 縮む中身（同じ文字の繰り返し） */
const REPETITIVE_JSON = Buffer.from(
  JSON.stringify({ rows: "x".repeat(20_000) })
)
/** 縮まない中身 */
const IMAGE_BYTES = Buffer.from(
  Array.from({ length: 5_000 }, (_unused, byteIndex) => (byteIndex * 31) % 251)
)

/** 書いてから読み直した ZIP（中央ディレクトリの記録を持たせるため） */
const legacyZip = (): AdmZip => {
  const writer = new AdmZip()
  writer.addFile("manifest.json", Buffer.from("{}"))
  writer.addFile("data.json", REPETITIVE_JSON)
  writer.addFile("images/page-1.png", IMAGE_BYTES)
  return new AdmZip(writer.toBuffer())
}

const limitsWith = (
  overrides: Partial<ArchiveZipLimits>
): ArchiveZipLimits => ({
  ...DEFAULT_ARCHIVE_ZIP_LIMITS,
  ...overrides,
})

describe("旧形式のアーカイブの大きさの上限", () => {
  it("既定の上限なら通る", () => {
    expect(() => assertLegacyZipWithinLimits(legacyZip())).not.toThrow()
  })

  it("項目の数が上限を超えれば断る", () => {
    expect(() =>
      assertLegacyZipWithinLimits(legacyZip(), limitsWith({ maxEntries: 2 }))
    ).toThrow(/項目の数/)
  })

  it("伸張後の合計が上限を超えれば断る", () => {
    expect(() =>
      assertLegacyZipWithinLimits(
        legacyZip(),
        limitsWith({ maxTotalUncompressedBytes: REPETITIVE_JSON.length })
      )
    ).toThrow(/合計/)
  })

  it("1項目の伸張後の大きさが上限を超えれば断る", () => {
    expect(() =>
      assertLegacyZipWithinLimits(
        legacyZip(),
        limitsWith({ maxEntryUncompressedBytes: REPETITIVE_JSON.length - 1 })
      )
    ).toThrow(/data\.json/)
  })

  it("縮み方が上限を超える項目は断る", () => {
    expect(() =>
      assertLegacyZipWithinLimits(
        legacyZip(),
        limitsWith({
          maxCompressionRatio: 2,
          compressionRatioExemptBytes: 1024,
        })
      )
    ).toThrow(/data\.json/)
  })
})
