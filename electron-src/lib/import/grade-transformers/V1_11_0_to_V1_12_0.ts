/**
 * grade-archive 1.11.0 → 1.12.0
 *
 * 内包している試験外成績資料を、入れ子・射影形式からテーブルごとの平坦なセクションへ
 * 展開する（coursework-archive 1.0.0 → 1.1.0 と同じ変換）。併せて点数の参照が
 * 人（Student）から資料の対象者（CourseworkStudent）へ移り、名簿に載っていない
 * 生徒の点数は破棄される（#962 Phase B）。
 *
 * 展開の実体は coursework-transformers/legacyShape が持つ（二重実装の回避）。
 */

import type {
  GradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "../../../../src/types/gradeArchive.types"
import {
  flattenLegacyCourseworks,
  isLegacyCollectedCourseworkData,
} from "../coursework-transformers/legacyShape"

export class V1_11_0_to_V1_12_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion = "1.11.0" as const
  readonly toVersion = "1.12.0" as const

  transform(data: GradeArchiveData): GradeTransformResult {
    const legacy = data.legacyCourseworkArchive
    if (!isLegacyCollectedCourseworkData(legacy)) {
      return { data, warnings: [] }
    }

    const { sections, discardedScoreCount } = flattenLegacyCourseworks(
      legacy.courseworks
    )

    const warnings = [
      "1.11.0→1.12.0: 内包する試験外成績資料をテーブルごとの形式へ変換しました（作成・更新時刻は旧形式に無いため復元できません）",
    ]
    if (discardedScoreCount > 0) {
      warnings.push(
        `1.11.0→1.12.0: 対象生徒として登録されていない生徒の点数 ${discardedScoreCount} 件を破棄しました`
      )
    }

    return {
      data: {
        ...data,
        legacyCourseworkArchive: undefined,
        courseworkArchive: {
          ...sections,
          studentsData: legacy.studentsData,
          classesData: legacy.classesData,
          membershipsData: legacy.membershipsData,
          tagsData: legacy.tagsData,
          counts: {
            courseworks: sections.courseworks.length,
            items: sections.courseworkItems.length,
            scores: sections.courseworkScores.length,
            students: legacy.studentsData.length,
            classrooms: legacy.classesData.length,
          },
        },
      },
      warnings,
    }
  }
}
