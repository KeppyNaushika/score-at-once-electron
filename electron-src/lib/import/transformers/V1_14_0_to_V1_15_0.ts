/**
 * v1.14.0 → v1.15.0 変換器（学級統計の再設計）
 *
 * 主な変更点:
 * - ExamClassroom.statistics 廃止 → teacherStat（教員集計対象）へ移行
 * - ExamClassroom.studentReport（生徒表示対象）追加。旧仕様では administered が
 *   生徒表示を兼ねていたため administered から補完する
 * - ExamSubtotalGroup に selectedForTable / selectedForBoxPlot 追加
 *
 * NOTE: JSON キーの examClasses→examClassrooms リネームは歴史上 v1.16.0 だが、
 * キー正規化は意味論を変えず冪等なため先頭で適用し、本変換器以降を現行キーで書く。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"
import { normalizeLegacyClassroomKeys } from "../shared/legacyClassroomKeys"

export class V1_14_0_to_V1_15_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.14.0"
  readonly toVersion: ExamArchiveVersion = "1.15.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const examData = normalizeLegacyClassroomKeys(data.examData)

    // v1.1.0 以前のアーカイブには examClassrooms キー自体が無い場合がある
    const examClassrooms = (examData.examClassrooms ?? []).map(
      (examClassroom) => {
        const { statistics, ...rest } = examClassroom
        return {
          ...rest,
          teacherStat: examClassroom.teacherStat ?? statistics ?? false,
          studentReport:
            examClassroom.studentReport ?? examClassroom.administered ?? false,
        }
      }
    )

    const examSubtotalGroups = (examData.examSubtotalGroups ?? []).map(
      (examSubtotalGroup) => ({
        ...examSubtotalGroup,
        selectedForTable: examSubtotalGroup.selectedForTable ?? false,
        selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
      })
    )

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: {
          ...examData,
          examClassrooms,
          examSubtotalGroups,
        },
      },
      warnings: [
        "1.14.0→1.15.0: 学級の出力フラグを statistics→teacherStat / administered→studentReport へ移行しました。",
      ],
    }
  }
}
