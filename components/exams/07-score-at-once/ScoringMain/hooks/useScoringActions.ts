/**
 * 採点アクションフック
 *
 * ScoringMainViewから抽出された採点関連のアクション
 * - コンテキスト値の設定
 * - 設定変更ハンドラー
 * - 初期化処理
 */

import type { QuestionScore } from "@prisma/client"
import { useCallback, useEffect } from "react"

/**
 * useScoringActionsの入力パラメータ
 */
interface UseScoringActionsParams {
  /** 試験ID */
  examId: string
  /** ローディング状態 */
  loading: boolean
  /** 試験情報（存在確認用） */
  exam: unknown | null
  /** 採点スコア読み込み関数 */
  loadQuestionScores: (examId: string) => Promise<QuestionScore[]>
  /** 採点スコア設定関数 */
  setQuestionScores: (scores: QuestionScore[]) => void
  /** 表示設定: 生徒名表示状態 */
  showStudentNames: boolean
  /** 表示設定: 生徒名表示設定関数 */
  setShowStudentNames: (show: boolean) => void
  /** 表示設定: 1行あたりの項目数設定関数 */
  setItemsPerLine: (value: number[]) => void
  /** 表示設定: 自動スクロール設定関数 */
  setAutoScroll: (enabled: boolean) => void
}

/**
 * useScoringActionsの戻り値
 */
interface UseScoringActionsReturn {
  /** 生徒名表示切り替えハンドラー */
  handleToggleStudentNames: () => void
  /** 1行あたりの項目数変更ハンドラー */
  handleItemsPerLineChange: (value: number[]) => void
  /** 自動スクロール変更ハンドラー */
  handleAutoScrollChange: (enabled: boolean) => void
}

/**
 * 採点アクションフック
 *
 * @param params - 採点アクションに必要なパラメータ
 * @returns アクションハンドラー群
 */
export function useScoringActions(
  params: UseScoringActionsParams
): UseScoringActionsReturn {
  const {
    examId,
    loading,
    exam,
    loadQuestionScores,
    setQuestionScores,
    showStudentNames,
    setShowStudentNames,
    setItemsPerLine,
    setAutoScroll,
  } = params

  /**
   * 採点データの初期化
   */
  useEffect(() => {
    const initializeGradingData = async () => {
      if (!loading && exam) {
        try {
          const existingScores = await loadQuestionScores(examId)
          setQuestionScores(existingScores)
        } catch (error) {
          console.error("Failed to initialize grading data:", error)
        }
      }
    }

    initializeGradingData()
  }, [examId, loading, exam, loadQuestionScores, setQuestionScores])

  /**
   * 生徒名表示切り替えハンドラー
   */
  const handleToggleStudentNames = useCallback(() => {
    setShowStudentNames(!showStudentNames)
  }, [showStudentNames, setShowStudentNames])

  /**
   * 1行あたりの項目数変更ハンドラー
   */
  const handleItemsPerLineChange = useCallback(
    (value: number[]) => {
      setItemsPerLine(value)
    },
    [setItemsPerLine]
  )

  /**
   * 自動スクロール変更ハンドラー
   */
  const handleAutoScrollChange = useCallback(
    (enabled: boolean) => {
      setAutoScroll(enabled)
    },
    [setAutoScroll]
  )

  return {
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  }
}
