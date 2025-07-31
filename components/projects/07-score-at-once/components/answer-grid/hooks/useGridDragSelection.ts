import { RefObject } from "react"
import type { AnswerItem } from "@/components/projects/07-score-at-once/components/answer-grid/types/grid-types"

interface UseGridDragSelectionProps {
  gridRef: RefObject<HTMLDivElement | null>
  onAnswerSelect: (id: string, isSelected: boolean) => void
  selectedAnswers: Set<string>
  sortedAnswers: () => AnswerItem[]
}

export function useGridDragSelection({
  gridRef,
  onAnswerSelect,
  selectedAnswers,
  sortedAnswers,
}: UseGridDragSelectionProps) {
  // マウスドラッグ選択
  const handleMouseDown = (event: React.MouseEvent, answerId: string) => {
    // 模範解答の場合は選択処理をスキップ
    if (answerId.startsWith("master-")) {
      event.preventDefault()
      return
    }

    // Ctrlキーが押されている場合は複数選択（追加・削除切り替え）
    if (event.ctrlKey) {
      event.preventDefault()
      onAnswerSelect(answerId, !selectedAnswers.has(answerId))
    }
    // Shiftキーが押されている場合は範囲選択
    else if (event.shiftKey) {
      event.preventDefault()
      handleShiftSelect(answerId)
    }
    // 通常クリック（単一選択または新規選択開始）
    else {
      if (!selectedAnswers.has(answerId)) {
        // 現在の選択をクリア
        selectedAnswers.forEach((id) => onAnswerSelect(id, false))
        // 新しい選択を追加
        onAnswerSelect(answerId, true)
      }
    }
  }

  // Shift+クリックでの範囲選択処理
  const handleShiftSelect = (endAnswerId: string) => {
    const answers = sortedAnswers()
    if (answers.length === 0) return

    // 既に選択されている最初の答案を取得
    let startIndex = -1
    for (let i = 0; i < answers.length; i++) {
      if (selectedAnswers.has(answers[i].id)) {
        startIndex = i
        break
      }
    }

    // 終了位置を取得
    const endIndex = answers.findIndex((answer) => answer.id === endAnswerId)

    if (startIndex === -1 || endIndex === -1) {
      // 範囲選択できない場合は単一選択
      onAnswerSelect(endAnswerId, true)
      return
    }

    // 範囲を選択
    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    for (let i = minIndex; i <= maxIndex; i++) {
      if (i < answers.length) {
        onAnswerSelect(answers[i].id, true)
      }
    }
  }

  // 選択範囲の描画を計算する関数
  const getDragSelectionRect = (
    dragStart: { x: number; y: number } | null,
    dragCurrent: { x: number; y: number } | null,
  ) => {
    if (!dragStart || !dragCurrent || !gridRef.current) return null

    // スクロール位置を取得
    const scrollLeft = gridRef.current.scrollLeft
    const scrollTop = gridRef.current.scrollTop

    // dragStartとdragCurrentは既にグリッドコンテナに対する相対座標だが、
    // 表示用にはスクロール位置を加算する必要がある
    const startX = Math.min(dragStart.x, dragCurrent.x) + scrollLeft
    const endX = Math.max(dragStart.x, dragCurrent.x) + scrollLeft
    const startY = Math.min(dragStart.y, dragCurrent.y) + scrollTop
    const endY = Math.max(dragStart.y, dragCurrent.y) + scrollTop

    return {
      left: startX,
      top: startY,
      width: endX - startX,
      height: endY - startY,
    }
  }

  // ドラッグによる矩形選択処理
  const handleDragSelection = (
    event: React.MouseEvent,
    dragStart: { x: number; y: number } | null,
  ) => {
    if (!dragStart || !gridRef.current) return

    const gridElement = gridRef.current
    const gridRect = gridElement.getBoundingClientRect()

    // 現在のマウス位置をグリッドコンテナに対する相対座標に変換
    const currentX = event.clientX - gridRect.left
    const currentY = event.clientY - gridRect.top

    // 矩形選択範囲を計算（dragStartは既にグリッドコンテナに対する相対座標）
    const startX = Math.min(dragStart.x, currentX)
    const endX = Math.max(dragStart.x, currentX)
    const startY = Math.min(dragStart.y, currentY)
    const endY = Math.max(dragStart.y, currentY)

    // グリッド内の答案カードをチェック
    const cardElements = gridElement.querySelectorAll("[data-answer-id]")
    const selectedIds: string[] = []

    cardElements.forEach((cardElement) => {
      const rect = cardElement.getBoundingClientRect()
      const relativeRect = {
        left: rect.left - gridRect.left,
        right: rect.right - gridRect.left,
        top: rect.top - gridRect.top,
        bottom: rect.bottom - gridRect.top,
      }

      // 矩形と重なるかチェック
      if (
        relativeRect.left < endX &&
        relativeRect.right > startX &&
        relativeRect.top < endY &&
        relativeRect.bottom > startY
      ) {
        const answerId = cardElement.getAttribute("data-answer-id")
        if (answerId) {
          selectedIds.push(answerId)
        }
      }
    })

    // 選択状態を更新
    if (selectedIds.length > 0) {
      // 現在の選択をクリア
      selectedAnswers.forEach((id) => onAnswerSelect(id, false))
      // 新しい選択を追加
      selectedIds.forEach((id) => onAnswerSelect(id, true))
    }
  }

  return {
    handleMouseDown,
    handleShiftSelect,
    getDragSelectionRect,
    handleDragSelection,
  }
}