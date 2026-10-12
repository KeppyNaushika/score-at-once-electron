/**
 * adm-zip で読む旧形式のアーカイブ（.score・.coursework・.grade・.asb・.students と外部形式）の
 * 大きさの上限
 *
 * adm-zip は1項目の伸張を記録された大きさで頭打ちにするが、項目の数と合計には上限を持たない。
 * 展開（`extractAllTo`）や中身の読み出しの前に、中央ディレクトリの記録（`header.size`・
 * `header.compressedSize`）を、統合アーカイブ（.sao）と同じ規則（`archiveZipReader.ts` の
 * `describeZipLimitViolation`）で照らす。
 */

import type AdmZip from "adm-zip"

import {
  type ArchiveZipLimits,
  DEFAULT_ARCHIVE_ZIP_LIMITS,
  describeZipLimitViolation,
} from "../unified-archive/archiveZipReader"

/**
 * 開いた ZIP の項目の数・伸張後の大きさ・縮み方が上限に収まることを確かめる。
 * 超えていれば、利用者に見せる理由の付いた例外を投げる（何も展開しない）
 */
export function assertLegacyZipWithinLimits(
  zip: AdmZip,
  limits: ArchiveZipLimits = DEFAULT_ARCHIVE_ZIP_LIMITS
): void {
  const violation = describeZipLimitViolation(
    zip.getEntries().map((entry) => ({
      name: entry.entryName,
      compressedSize: entry.header.compressedSize,
      uncompressedSize: entry.header.size,
    })),
    limits
  )
  if (violation !== null) {
    throw new Error(
      `アーカイブが大きすぎるか、中身の大きさが不自然なため取り込めません（${violation}）`
    )
  }
}
