/**
 * v1.16.0 → v1.17.0 変換器
 *
 * 主な変更点:
 * - ExamStudent.status を小文字に統一（participating / expected / absent）。
 *   旧アーカイブは大文字（PARTICIPATING / EXPECTED / ABSENT）で保存されている。
 *   DBマイグレーション 20260705000000_lowercase_examstudent_status と同一の正規化。
 *
 * 実際のインポートフロー（archiveExtractor）からは
 * normalizeExamStudentStatuses を直接利用する
 * （normalizeLegacyClassroomKeys と同じフィールド単位の互換処理パターン）。
 */

import type { ArchiveExamData } from "../../../../src/types/examArchive.types"
import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

/**
 * examData の ExamStudent.status を小文字へ正規化する。
 * 既に小文字の v1.17.0 アーカイブには無変更で冪等。
 */
export function normalizeExamStudentStatuses(
  examData: ArchiveExamData
): ArchiveExamData {
  return {
    ...examData,
    examStudents: examData.examStudents.map((examStudent) => ({
      ...examStudent,
      // status は非nullable(string)。壊れた手編集アーカイブの falsy 値でも
      // 例外を出さず既定の participating に倒す（型は string のまま）。
      status: (examStudent.status || "participating").toLowerCase(),
    })),
  }
}

export class V1_16_0_to_V1_17_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.16.0"
  readonly toVersion: ArchiveVersion = "1.17.0"

  transform(data: ArchiveData): TransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: normalizeExamStudentStatuses(data.examData),
      },
      warnings: [
        "1.16.0→1.17.0: ExamStudent.status を小文字（participating/expected/absent）へ正規化しました。",
      ],
    }
  }
}
