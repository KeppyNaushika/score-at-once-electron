/**
 * 成績算出プロジェクトのステータス判定ユーティリティ
 *
 * プロジェクト一覧で「次のステップ」ボタンを表示し、
 * 詳細ページでフェーズカード+進捗を表示するために使用
 */

import type { GradeProjectWithDetails } from "@/types/gradeProject.types"

export interface GradeProjectStatus {
  step: number
  text: string
  url: string
}

/** 各ステップの完了状態 */
export interface GradeProjectStepCompletion {
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
 * 成績算出プロジェクトの各ステップ完了状態を取得
 */
export function getGradeProjectCompletion(
  gradeProject: GradeProjectWithDetails
): GradeProjectStepCompletion {
  const studentCount = gradeProject._count?.gradeProjectStudents ?? 0
  const boundarySetsCount = gradeProject._count?.boundarySets ?? 0

  const dataSources = gradeProject.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  )

  const manualDataSources = dataSources.filter(
    (dataSource) => dataSource.type === "manual"
  )
  const hasManualDataSources = manualDataSources.length > 0
  const allManualScoresEntered =
    !hasManualDataSources ||
    manualDataSources.every(
      (dataSource) => (dataSource._count?.manualScores ?? 0) > 0
    )

  return {
    hasSetup: true, // プロジェクトが存在すれば基本設定は完了
    hasStudents: studentCount > 0,
    hasDataSources: dataSources.length > 0,
    hasManualScores: allManualScoresEntered,
    hasBoundaries: boundarySetsCount > 0,
  }
}

/**
 * 成績算出プロジェクトの現在のステータス（次のステップ）を判定
 */
export function getGradeProjectStatus(
  gradeProject: GradeProjectWithDetails
): GradeProjectStatus {
  const id = gradeProject.id
  const completion = getGradeProjectCompletion(gradeProject)

  if (!completion.hasStudents) {
    return {
      step: 2,
      text: "生徒の登録",
      url: `/grade-projects/${id}/02-students`,
    }
  }

  if (!completion.hasDataSources) {
    return {
      step: 3,
      text: "データソースの設定",
      url: `/grade-projects/${id}/03-data-sources`,
    }
  }

  if (!completion.hasManualScores) {
    return {
      step: 4,
      text: "外部成績の入力",
      url: `/grade-projects/${id}/04-manual-scores`,
    }
  }

  if (!completion.hasBoundaries) {
    return {
      step: 5,
      text: "成績境界の設定",
      url: `/grade-projects/${id}/05-boundaries`,
    }
  }

  return {
    step: 7,
    text: "結果の出力",
    url: `/grade-projects/${id}/07-export`,
  }
}
