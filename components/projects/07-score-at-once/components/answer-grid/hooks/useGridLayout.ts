import { useCallback, useMemo } from "react"
import type { AnswerItem, GridLayoutDirection } from "@/components/projects/07-score-at-once/components/answer-grid/types/grid-types"

interface UseGridLayoutProps {
  answers: AnswerItem[]
  layoutDirection: GridLayoutDirection
  itemsPerRow: number[]
  gridSize: { columns: number; rows: number }
}

export function useGridLayout({
  answers,
  layoutDirection,
  itemsPerRow,
  gridSize,
}: UseGridLayoutProps) {
  // 実際に使用するgridSizeを計算
  const effectiveGridSize = useMemo(
    () => ({
      columns: itemsPerRow[0] === 0 ? gridSize.columns : itemsPerRow[0], // 0の場合は元のgridSizeを使用
      rows:
        layoutDirection === "down-right" || layoutDirection === "down-left"
          ? itemsPerRow[0] // 下→右レイアウトでは1列の表示件数として使用
          : gridSize.rows,
    }),
    [itemsPerRow, gridSize.columns, gridSize.rows, layoutDirection],
  )

  // レイアウト方向に応じて答案を並び替え
  const sortedAnswers = useCallback(() => {
    // 下→右・下→左レイアウトでは、CSS Gridのgrid-auto-flow: columnが自動で縦配置するため
    // ソート変換不要、元の順序のまま使用
    if (layoutDirection === "down-right" || layoutDirection === "down-left") {
      return answers // 元の順序をそのまま使用
    }

    // 右→下レイアウトのみソート処理
    if (layoutDirection === "right-down") {
      return answers // デフォルト順序
    }

    // 左→下レイアウト用のソート
    if (layoutDirection === "left-down") {
      const totalAnswers = answers.length
      const cols = effectiveGridSize.columns
      const sorted = new Array(totalAnswers)

      answers.forEach((answer, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        const newIndex = row * cols + (cols - 1 - col)
        if (newIndex < totalAnswers) {
          sorted[newIndex] = answer
        }
      })

      return sorted.filter(Boolean)
    }

    return answers
  }, [answers, layoutDirection, effectiveGridSize])

  return {
    effectiveGridSize,
    sortedAnswers,
  }
}