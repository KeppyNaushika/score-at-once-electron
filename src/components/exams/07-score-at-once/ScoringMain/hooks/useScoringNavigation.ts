import { useCallback } from "react"

import type {
  CropRegionWithExamPage,
  LayoutDirection,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"

/** ScoringDataに選択状態を追加した型 */
type ScoringDataWithSelection = ScoringData & { isSelected: boolean }

interface UseScoringNavigationProps {
  answerSheetsLength: number
  currentCropRegionId: string | null
  setCurrentCropRegionId: (id: string | null) => void
  selectedStudentAnswerImageIds: Set<string>
  setSelectedPageImageIds: (answers: Set<string>) => void
  layoutDirection: LayoutDirection
  getGridAnswerData: () => ScoringDataWithSelection[]
  effectiveColumns?: number
  cropRegions?: CropRegionWithExamPage[]
}

/** 設問間の前後移動とWASDキーによるグリッド内ナビゲーションを提供するフック */
export function useScoringNavigation({
  answerSheetsLength,
  currentCropRegionId,
  setCurrentCropRegionId,
  selectedStudentAnswerImageIds,
  setSelectedPageImageIds,
  layoutDirection,
  getGridAnswerData,
  effectiveColumns,
  cropRegions = [],
}: UseScoringNavigationProps) {
  // ナビゲーション関数
  const handleNextQuestion = useCallback(() => {
    if (!currentCropRegionId || !cropRegions.length) return

    const currentIndex = cropRegions.findIndex(
      (region) => region.id === currentCropRegionId
    )
    if (currentIndex === -1 || currentIndex >= cropRegions.length - 1) return

    const nextRegion = cropRegions[currentIndex + 1]
    if (nextRegion) {
      setCurrentCropRegionId(nextRegion.id)
    }
  }, [currentCropRegionId, cropRegions, setCurrentCropRegionId])

  const handlePrevQuestion = useCallback(() => {
    if (!currentCropRegionId || !cropRegions.length) return

    const currentIndex = cropRegions.findIndex(
      (region) => region.id === currentCropRegionId
    )
    if (currentIndex <= 0) return

    const prevRegion = cropRegions[currentIndex - 1]
    if (prevRegion) {
      setCurrentCropRegionId(prevRegion.id)
    }
  }, [currentCropRegionId, cropRegions, setCurrentCropRegionId])

  // 模範解答をスキップして次の有効な答案を見つける関数
  const findNextValidAnswer = useCallback(
    (
      startIndex: number,
      direction: number,
      gridAnswers: ScoringDataWithSelection[]
    ): number => {
      const totalAnswers = gridAnswers.length
      for (let i = startIndex; i >= 0 && i < totalAnswers; i += direction) {
        const answer = gridAnswers[i]
        if (!answer.id.startsWith("master-")) {
          return i
        }
      }
      return -1
    },
    []
  )

  // WASD移動ハンドラー（レイアウト方向とフィルタリングに対応）
  const handleGridNavigation = useCallback(
    (key: string) => {
      if (answerSheetsLength === 0) return

      const gridAnswers = getGridAnswerData()
      const totalAnswers = gridAnswers.length

      if (totalAnswers === 0) return

      // effectiveColumnsから実際の1行/列あたりの表示件数を取得
      const actualItemsPerLine =
        effectiveColumns && effectiveColumns > 0 ? effectiveColumns : 4

      const cols = Math.max(1, actualItemsPerLine) // 実際の表示数を使用、最低1は確保

      // 現在選択されている答案のインデックスを取得
      let currentIndex = -1
      if (selectedStudentAnswerImageIds.size >= 1) {
        const selectedId = Array.from(selectedStudentAnswerImageIds)[0]
        currentIndex = gridAnswers.findIndex(
          (answer) => answer.id === selectedId
        )
      }

      // 何も選択されていない場合は最初の生徒答案を選択（模範解答をスキップ）
      if (currentIndex === -1) {
        const firstValidIndex = findNextValidAnswer(0, 1, gridAnswers)
        if (firstValidIndex !== -1) {
          setSelectedPageImageIds(new Set([gridAnswers[firstValidIndex].id]))
        }
        return
      }

      let newIndex = currentIndex

      // レイアウト方向に応じた移動処理
      switch (layoutDirection) {
        case "right-down": // 右→下方向
          switch (key) {
            case "w": // 上に移動（前の行、行境界を超えて移動可能）
              newIndex = currentIndex - cols
              if (newIndex < 0) {
                // 最上行の場合、前の答案を選択
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "s": // 下に移動（次の行、行境界を超えて移動可能）
              newIndex = currentIndex + cols
              if (newIndex >= totalAnswers) {
                // 最下行の場合、次の答案を選択
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "a": // 左に移動（列境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "d": // 右に移動（列境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break

        case "left-down": // 左→下方向
          switch (key) {
            case "w": // 上に移動（前の行、行境界を超えて移動可能）
              newIndex = currentIndex - cols
              if (newIndex < 0) {
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "s": // 下に移動（次の行、行境界を超えて移動可能）
              newIndex = currentIndex + cols
              if (newIndex >= totalAnswers) {
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "d": // 右に移動（左→下では前の列、境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "a": // 左に移動（左→下では次の列、境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break

        case "down-right": {
          // 下→右方向
          // 列表示では1列あたりの表示件数が実際の列の高さ（行数）となる
          const columnsForDownRight = actualItemsPerLine // 1列あたりの表示件数
          switch (key) {
            case "a": // 左に移動（前の列、列境界を超えて移動可能）
              newIndex = currentIndex - columnsForDownRight
              if (newIndex < 0) {
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "d": // 右に移動（次の列、列境界を超えて移動可能）
              newIndex = currentIndex + columnsForDownRight
              if (newIndex >= totalAnswers) {
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "w": // 上に移動（行境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "s": // 下に移動（行境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break
        }

        case "down-left": {
          // 下→左方向
          // 列表示では1列あたりの表示件数が実際の列の高さ（行数）となる
          const columnsForDownLeft = actualItemsPerLine // 1列あたりの表示件数
          switch (key) {
            case "d": // 右に移動（下→左では前の列、境界を超えて移動可能）
              newIndex = currentIndex - columnsForDownLeft
              if (newIndex < 0) {
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "a": // 左に移動（下→左では次の列、境界を超えて移動可能）
              newIndex = currentIndex + columnsForDownLeft
              if (newIndex >= totalAnswers) {
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "w": // 上に移動（行境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "s": // 下に移動（行境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break
        }
      }

      // 範囲チェックして模範解答をスキップ
      if (
        newIndex >= 0 &&
        newIndex < totalAnswers &&
        newIndex !== currentIndex
      ) {
        const targetAnswer = gridAnswers[newIndex]
        if (!targetAnswer.id.startsWith("master-")) {
          setSelectedPageImageIds(new Set([targetAnswer.id]))
        } else {
          // 模範解答の場合、方向に応じて次の有効な答案を探す
          const direction = newIndex > currentIndex ? 1 : -1
          const validIndex = findNextValidAnswer(
            newIndex + direction,
            direction,
            gridAnswers
          )
          if (validIndex !== -1) {
            setSelectedPageImageIds(new Set([gridAnswers[validIndex].id]))
          }
        }
      }
    },
    [
      answerSheetsLength,
      getGridAnswerData,
      selectedStudentAnswerImageIds,
      setSelectedPageImageIds,
      layoutDirection,
      findNextValidAnswer,
      effectiveColumns,
    ]
  )

  return {
    handleNextQuestion,
    handlePrevQuestion,
    handleGridNavigation,
  }
}
