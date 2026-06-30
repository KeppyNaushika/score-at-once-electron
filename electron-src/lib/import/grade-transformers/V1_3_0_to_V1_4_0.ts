/**
 * grade-archive 1.3.0 → 1.4.0
 *
 * 旧 v1.3.0 の外部成績（manual 型 DataSource + manual-scores.json）を、
 * v1.4.0 の名前ベース埋め込み資料（courseworks）へ変換する。
 * 併せて manual 型 DataSource を coursework 型へ書き換え、参照先（資料名・項目名・
 * 評価項目 id）を付与して後段の再リンクを可能にする。
 *
 * ※ 旧 importer のインライン変換ロジック（ensureCoursework 経由）の純データ版。
 * 入力 data は破壊しない（preview と import で二度適用されても結果が同一になるよう
 * 純粋・決定的に作る）。資料/評価項目 id は (gradeName, gradeItemName, dataSourceName)
 * から決定的に導出し、preview/import 間で archiveId が一致するようにする。
 */

import type {
  ArchiveCoursework,
  ArchiveDataSource,
  ArchiveGradeItem,
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
    const gradeName = data.manifest.gradeName

    // 当該 grade の対象生徒（GradeStudent と同じ studentRefs）を名簿に流用
    const cwStudents = data.gradeData.studentRefs.map((s) => ({
      studentNumber: s.studentNumber,
      customOrder: s.customOrder,
    }))

    const generated: ArchiveCoursework[] = []
    let converted = false

    // gradeItems / dataSources を新規オブジェクトで作り直す（入力は破壊しない）
    const newGradeItems: ArchiveGradeItem[] = data.gradeData.gradeItems.map(
      (giData) => ({
        ...giData,
        dataSources: giData.dataSources.map((dsData): ArchiveDataSource => {
          if (dsData.type !== "manual") return dsData
          converted = true

          // 決定的 id（preview と import で一致させる）
          const key = `${gradeName}::${giData.name}::${dsData.name}`
          const courseworkId = `legacy-manual-cw:${key}`
          const itemId = `legacy-manual-item:${key}`

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

          generated.push({
            id: courseworkId,
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
                // 旧1.3.0 "manual" の満点 → CourseworkItem.maxScore
                //（ArchiveDataSource.maxScore は v1.6.0 で optional 化済み）
                maxScore: dsData.maxScore ?? 0,
                inputMode: dsData.inputMode ?? "numeric",
                letterScales: dsData.letterScales ?? [],
                scores: itemScores,
              },
            ],
          })

          // manual → coursework へ昇格し、参照先を付与（id 一次・名前二次）
          return {
            ...dsData,
            type: "coursework",
            courseworkItemId: itemId,
            courseworkName: dsData.name,
            courseworkItemName: dsData.name,
          }
        }),
      })
    )

    if (converted) {
      warnings.push("v1.3.0 の外部成績を試験外成績資料に変換しました")
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        gradeData: { ...data.gradeData, gradeItems: newGradeItems },
        // 既存 courseworks があれば温存しつつ manual 由来を追加
        courseworks: [...(data.courseworks ?? []), ...generated],
        manualScoresData: undefined,
      },
      warnings,
    }
  }
}
