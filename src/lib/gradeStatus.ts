/**
 * 成績算出試験のステータス判定ユーティリティ
 *
 * 試験一覧で「次のステップ」ボタンを表示し、
 * 詳細ページでフェーズカード+進捗を表示するために使用
 */

import type { Prisma } from "@prisma/client"

import type { Serialized } from "@/types/prismaExtensions"

/**
 * 進捗判定が読む成績1件。
 *
 * 一覧（`grade.getAll` の `gradeSummaryInclude`）と詳細（`grade.getById` の
 * `gradeWithRelationsInclude`）の双方が、この include を含む形で取っている。
 * 以前はここに「この関数が読むフィールド」だけを手で宣言していたが、列や
 * リレーションが増減しても検査に掛からないため、Prisma の payload から導く。
 * 境界を越えた後の行なので `Serialized`（Decimal → number）を被せる。
 */
type GradeProgressSource = Serialized<
  Prisma.GradeGetPayload<{
    include: {
      gradeStudents: true
      gradeItems: {
        include: {
          boundaries: true
          dataSources: {
            include: { courseworkItem: { include: { scores: true } } }
          }
        }
      }
    }
  }>
>

interface GradeStatus {
  step: number
  text: string
  url: string
}

/** 各ステップの完了状態 */
export interface GradeStepCompletion {
  /** 1. 基本設定（名前が設定済みなら完了） */
  hasSetup: boolean
  /** 2. 生徒管理 */
  hasStudents: boolean
  /** 3. データソース */
  hasDataSources: boolean
  /** 4. 外部成績（manual型がなければtrue、あればスコア入力済み） */
  hasManualScores: boolean
  /** 5. 成績境界 */
  hasBoundaries: boolean
}

/**
 * 成績算出試験の各ステップ完了状態を取得
 */
export function getGradeCompletion(
  grade: GradeProgressSource
): GradeStepCompletion {
  const studentCount = grade.gradeStudents.length
  // 境界が引かれている評価項目が1つでもあるか。境界の有無は行の有無そのものなので、
  // 「境界0本だが設定済み」という状態は作れない
  const hasAnyBoundary = grade.gradeItems.some(
    (gradeItem) => gradeItem.boundaries.length > 0
  )

  const dataSources = grade.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  )

  const courseworkDataSources = dataSources.filter(
    (dataSource) => dataSource.type === "coursework"
  )
  const hasCourseworkDataSources = courseworkDataSources.length > 0
  // 「次のステップ」提案用のソフトな進捗判定。参照中の評価項目に点数行が
  // 1件でもあれば入力着手済みとみなす（資料全体の概数。成績の対象生徒に対する
  // 厳密な入力済み数は 04-manual-scores の確認ビューで集計・表示する）。
  const allManualScoresEntered =
    !hasCourseworkDataSources ||
    courseworkDataSources.every(
      (dataSource) => (dataSource.courseworkItem?.scores.length ?? 0) > 0
    )

  return {
    hasSetup: true, // 試験が存在すれば基本設定は完了
    hasStudents: studentCount > 0,
    hasDataSources: dataSources.length > 0,
    hasManualScores: allManualScoresEntered,
    hasBoundaries: hasAnyBoundary,
  }
}

/**
 * 成績算出試験の現在のステータス（次のステップ）を判定
 */
export function getGradeStatus(grade: GradeProgressSource): GradeStatus {
  const id = grade.id
  const completion = getGradeCompletion(grade)

  if (!completion.hasStudents) {
    return {
      step: 2,
      text: "生徒の登録",
      url: `/grades/${id}/02-students`,
    }
  }

  if (!completion.hasDataSources) {
    return {
      step: 3,
      text: "データソースの設定",
      url: `/grades/${id}/03-data-sources`,
    }
  }

  if (!completion.hasManualScores) {
    return {
      step: 4,
      text: "外部成績の入力",
      url: `/grades/${id}/04-manual-scores`,
    }
  }

  if (!completion.hasBoundaries) {
    return {
      step: 5,
      text: "成績境界の設定",
      url: `/grades/${id}/05-boundaries`,
    }
  }

  return {
    step: 7,
    text: "結果の出力",
    url: `/grades/${id}/07-export`,
  }
}
