/**
 * v1.18.0 → v1.19.0 変換器
 *
 * 主な変更点:
 * - DeletedRecord（アプリ側 tombstone）を廃止。アーカイブは正本であり、存在については
 *   忠実に復元する方針へ統一したため、復活防止の tombstone は役目を失った。
 *   削除の伝搬は sqlite-nas-sync の `_tombstone`（deletedAt と updatedAt のLWW）が担う（issue #918）。
 *
 * 旧アーカイブに含まれる deletedRecordsData は取り込み先が無くなったので読み捨てる。
 * キーが無い現行形式に対しては無変更で冪等。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_18_0_to_V1_19_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.18.0"
  readonly toVersion: ExamArchiveVersion = "1.19.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const archiveRecord = { ...(data as unknown as Record<string, unknown>) }
    const droppedTombstones = archiveRecord.deletedRecordsData
    const droppedCount =
      droppedTombstones &&
      typeof droppedTombstones === "object" &&
      Array.isArray(
        (droppedTombstones as Record<string, unknown>).deletedRecords
      )
        ? (
            (droppedTombstones as Record<string, unknown>)
              .deletedRecords as unknown[]
          ).length
        : 0
    delete archiveRecord.deletedRecordsData

    const transformed = archiveRecord as unknown as ExamArchiveData

    return {
      data: {
        ...transformed,
        manifest: { ...data.manifest, version: this.toVersion },
      },
      warnings:
        droppedCount > 0
          ? [
              `1.18.0→1.19.0: 削除記録（tombstone）は廃止されたため、${droppedCount}件を読み飛ばしました。アーカイブに含まれるデータは削除記録に関わらず復元されます。`,
            ]
          : [],
    }
  }
}
