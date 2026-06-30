/**
 * grade-archive 1.3.0 → 1.4.0
 *
 * 旧 v1.3.0 の外部成績（manual 型 DataSource + manual-scores.json）を、
 * v1.4.0 の名前ベース埋め込み資料（courseworks）へ変換する。
 * 併せて manual 型 DataSource を coursework 型へ書き換え、参照先（資料名・項目名・
 * 評価項目 uuid）を付与して後段の再リンクを可能にする。
 *
 * ※ 旧 importer のインライン変換ロジック（ensureCoursework 経由）の純データ版。
 */

import { randomUUID } from "crypto"

import type {
  ArchiveCoursework,
  GradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "../../../../src/types/gradeArchive.types"

export class V1_3_0_to_V1_4_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion = "1.3.0" as const
  readonly toVersion = "1.4.0" as const

  transform(data: GradeArchiveData): GradeTransformResult {
    const warnings: string[] = []
    const manualScores = data.manualScoresData?.manualScores ?? []
    const courseworks: ArchiveCoursework[] = []

    // 当該 grade の対象生徒（GradeStudent と同じ studentRefs）を名簿に流用
    const cwStudents = data.gradeData.studentRefs.map((s) => ({
      studentNumber: s.studentNumber,
      customOrder: s.customOrder,
    }))

    let converted = false
    for (const giData of data.gradeData.gradeItems) {
      for (const dsData of giData.dataSources) {
        if (dsData.type !== "manual") continue
        converted = true

        const itemScores = manualScores
          .filter(
            (ms) =>
              ms.gradeItemName === giData.name &&
              ms.dataSourceName === dsData.name
          )
          .map((ms) => ({
            studentNumber: ms.studentNumber,
            score: ms.score,
            letterValue: ms.letterValue ?? null,
            adjustment: ms.adjustment ?? null,
            adjustmentReason: ms.adjustmentReason ?? null,
            comment: ms.comment ?? null,
          }))

        const itemId = randomUUID()
        courseworks.push({
          id: randomUUID(),
          name: dsData.name,
          description: null,
          date: null,
          classes: [],
          tags: [],
          students: cwStudents,
          items: [
            {
              id: itemId,
              name: dsData.name,
              order: 0,
              // 旧1.3.0 "manual" の満点 → CourseworkItem.maxScore（ArchiveDataSource.maxScore は optional 化済み）
              maxScore: dsData.maxScore ?? 0,
              inputMode: dsData.inputMode ?? "numeric",
              letterScales: dsData.letterScales ?? [],
              scores: itemScores,
            },
          ],
        })

        // manual → coursework へ昇格し、参照先を付与（uuid 一次・名前二次）
        dsData.type = "coursework"
        dsData.courseworkItemId = itemId
        dsData.courseworkName = dsData.name
        dsData.courseworkItemName = dsData.name
      }
    }

    if (converted) {
      warnings.push("v1.3.0 の外部成績を試験外成績資料に変換しました")
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        courseworks,
        manualScoresData: undefined,
      },
      warnings,
    }
  }
}
