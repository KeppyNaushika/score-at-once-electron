import type {
  GridAnswerItem,
  GridLayoutDirection,
} from "@/components/projects/07-score-at-once/ScoringGrid/types/grid-types"
import { useCallback, useMemo } from "react"

interface UseGridLayoutProps {
  answers: GridAnswerItem[]
  layoutDirection: GridLayoutDirection
  itemsPerRow: number[]
}

export function useGridLayout({
  answers,
  layoutDirection,
  itemsPerRow,
}: UseGridLayoutProps) {
  // 実際に使用するgridSizeを計算
  const effectiveGridSize = useMemo(
    () => ({
      columns: itemsPerRow[0] === 0 ? 4 : itemsPerRow[0], // 0の場合はデフォルト値4を使用
      rows:
        layoutDirection === "down-right" || layoutDirection === "down-left"
          ? itemsPerRow[0] // 下→右レイアウトでは1列の表示件数として使用
          : 3, // デフォルト値
    }),
    [itemsPerRow, layoutDirection],
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
