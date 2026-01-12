import { useCallback, useMemo } from "react"

import type { GridAnswerItem } from "@/components/projects/07-score-at-once/ScoringGrid/types/gridTypes"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"

interface UseGridLayoutProps {
  answers: GridAnswerItem[]
  layoutDirection: LayoutDirection
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
    [itemsPerRow, layoutDirection]
  )

  // レイアウト方向に応じて答案を並び替え
  const sortedAnswers = useCallback(() => {
    // console.log('🔍 useGridLayout debug - Input answers order:', answers.map((answer, index) => ({
    //   index,
    //   id: answer.id,
    //   studentName: answer.studentName
    // })))

    // console.log('🔍 useGridLayout debug - Layout direction:', layoutDirection)

    let result = answers

    // 下→右・下→左レイアウトでは、CSS Gridのgrid-auto-flow: columnが自動で縦配置するため
    // ソート変換不要、元の順序のまま使用
    if (layoutDirection === "down-right" || layoutDirection === "down-left") {
      result = answers // 元の順序をそのまま使用
    }
    // 右→下レイアウトのみソート処理
    else if (layoutDirection === "right-down") {
      result = answers // デフォルト順序
    }
    // 左→下レイアウト用のソート
    else if (layoutDirection === "left-down") {
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

      result = sorted.filter(Boolean)
    }

    // console.log('🔍 useGridLayout debug - Output answers order:', result.map((answer, index) => ({
    //   index,
    //   id: answer.id,
    //   studentName: answer.studentName
    // })))

    return result
  }, [answers, layoutDirection, effectiveGridSize])

  return {
    effectiveGridSize,
    sortedAnswers,
  }
}
