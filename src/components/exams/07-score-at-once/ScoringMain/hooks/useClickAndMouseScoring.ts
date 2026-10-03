import { useCallback, useMemo } from "react"

import type {
  GradingMode,
  MouseBrushAction,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"
import type { ClickScoringConfig } from "@/types/clickScoring.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface UseClickAndMouseScoringOptions {
  clickScoringConfig: ClickScoringConfig
  allScoringData: ScoringData[]
  filteredScoringDataIds: string[]
  replaceSelection: (answerIds: string[]) => void
  setGradingMode: (gradingMode: GradingMode) => void
  openPartialScoreModal: (targetAnswers?: Set<string>) => void
  /** 答案を採点し「いま採点した」印も付ける（ロックの判定の内側） */
  scoreAnswers: (
    status: ScoringStatus | MouseBrushAction,
    answerIds: string[]
  ) => void
}

/** クリック採点（回数ごとの割り当て）とマウスモードのブラシ採点・表示中の一括採点 */
export function useClickAndMouseScoring({
  clickScoringConfig,
  allScoringData,
  filteredScoringDataIds,
  replaceSelection,
  setGradingMode,
  openPartialScoreModal,
  scoreAnswers,
}: UseClickAndMouseScoringOptions) {
  /** クリック採点：デバウンス後にクリック回数に応じたアクションを実行 */
  const handleClickScoring = useCallback(
    (answerId: string, clickCount: number) => {
      if (answerId.startsWith("master-")) return
      const action = clickScoringConfig[clickCount as 2 | 3 | 4] ?? "none"
      if (action === "none") return

      if (action === "individual") {
        replaceSelection([answerId])
        setGradingMode("individual")
        return
      }

      if (action === "partial_modal") {
        replaceSelection([answerId])
        openPartialScoreModal(new Set([answerId]))
        return
      }

      // 採点ステータスを直接適用
      scoreAnswers(action, [answerId])
    },
    [
      clickScoringConfig,
      replaceSelection,
      setGradingMode,
      openPartialScoreModal,
      scoreAnswers,
    ]
  )

  /** マウスモード: クリック採点（トグル付き） */
  const handleMouseScoring = useCallback(
    (answerId: string, status: MouseBrushAction, isToggle: boolean) => {
      if (answerId.startsWith("master-")) return

      // 「部分点入力」ブラシ: クリックした答案の部分点入力モーダルを開く
      // （ダブルクリックの「部分点入力」動作と同じ）
      if (status === "partial_modal") {
        replaceSelection([answerId])
        openPartialScoreModal(new Set([answerId]))
        return
      }

      // トグル: 同じステータスなら未採点に戻す。
      //
      // 判断の元にするのはキャッシュだが、**画面の色も同じキャッシュから出ている**。
      // 利用者は色が変わったのを見てから押すので、両者が食い違うのは取り直しが
      // 着地する前の一瞬だけ。そこで押したなら、見えている姿（未採点）に対する
      // 「塗る」であって、意図とはずれない（R6 で検討して据え置き）
      if (isToggle) {
        const currentData = allScoringData.find(
          (scoringData) => scoringData.id === answerId
        )
        if (currentData?.status === status) {
          scoreAnswers("unscored", [answerId])
          return
        }
      }

      scoreAnswers(status, [answerId])
    },
    [allScoringData, scoreAnswers, replaceSelection, openPartialScoreModal]
  )

  /** マウスモード: 表示中の未採点を一括採点 */
  const handleBatchScoreVisibleUnscored = useCallback(
    (status: MouseBrushAction) => {
      const unscoredVisible = allScoringData.filter(
        (scoringData) =>
          scoringData.status === "unscored" &&
          filteredScoringDataIds.includes(scoringData.id)
      )
      if (unscoredVisible.length === 0) return
      scoreAnswers(
        status,
        unscoredVisible.map((scoringData) => scoringData.id)
      )
    },
    [allScoringData, filteredScoringDataIds, scoreAnswers]
  )

  /** 表示中の未採点件数 */
  const visibleUnscoredCount = useMemo(
    () =>
      allScoringData.filter(
        (scoringData) =>
          scoringData.status === "unscored" &&
          filteredScoringDataIds.includes(scoringData.id)
      ).length,
    [allScoringData, filteredScoringDataIds]
  )

  /** 非表示の未採点件数 */
  const hiddenUnscoredCount = useMemo(
    () =>
      allScoringData.filter(
        (scoringData) =>
          scoringData.status === "unscored" &&
          !filteredScoringDataIds.includes(scoringData.id)
      ).length,
    [allScoringData, filteredScoringDataIds]
  )

  return {
    handleClickScoring,
    handleMouseScoring,
    handleBatchScoreVisibleUnscored,
    visibleUnscoredCount,
    hiddenUnscoredCount,
  }
}
