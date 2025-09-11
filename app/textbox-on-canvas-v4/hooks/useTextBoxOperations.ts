/**
 * @fileoverview テキストボックス操作カスタムフック
 * @description テキストボックスの作成・選択・編集操作を管理
 */

"use client"

import { useCallback, useState } from "react"
import { TEXTBOX_SETTINGS } from "../constants"
import type { AnchorDirection, DragState, TextBox } from "../types"
import { isAnchorClicked } from "../utils/canvasUtils"
import {
  createAnchorFromClick,
  findTextBoxAtPoint,
  getCanvasCoordinates,
  updateTextBoxContent,
  updateTextBoxSelection,
} from "../utils/coordinateUtils"

/**
 * テキストボックス操作フック
 */
export function useTextBoxOperations() {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(
    null,
  )
  const [currentDrag, setCurrentDrag] = useState<DragState | null>(null)
  const [isCreatingAnchor, setIsCreatingAnchor] = useState<boolean>(false)
  const [isDraggingAnchor, setIsDraggingAnchor] = useState<boolean>(false)

  // テキスト入力関連の状態
  const [showTextInput, setShowTextInput] = useState<boolean>(false)
  const [textInputValue, setTextInputValue] = useState<string>("")

  /**
   * マウスダウンイベントハンドラー
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, zoom: number): void => {
      const canvas = e.currentTarget as HTMLCanvasElement
      if (!canvas) return

      const coords = getCanvasCoordinates(e.clientX, e.clientY, canvas, zoom)

      // アンカーがクリックされたかチェック
      let anchorClicked = false
      for (const textBox of textBoxes) {
        if (isAnchorClicked(coords.x, coords.y, textBox.x, textBox.y)) {
          setTextBoxes(updateTextBoxSelection(textBoxes, textBox.id))
          setSelectedTextBoxId(textBox.id)
          setIsDraggingAnchor(true)
          setCurrentDrag({
            startX: coords.x,
            startY: coords.y,
            currentX: coords.x,
            currentY: coords.y,
          })
          anchorClicked = true
          break
        }
      }

      if (!anchorClicked) {
        // テキストボックスの選択チェック
        const clickedTextBox = findTextBoxAtPoint(textBoxes, coords)

        if (clickedTextBox) {
          // 既存のテキストボックスをクリック
          setTextBoxes(updateTextBoxSelection(textBoxes, clickedTextBox.id))
          setSelectedTextBoxId(clickedTextBox.id)

          // ダブルクリックでテキスト編集
          if (selectedTextBoxId === clickedTextBox.id) {
            setTextInputValue(clickedTextBox.text)
            setShowTextInput(true)
          }
        } else {
          // 新しいアンカーの作成
          setTextBoxes(updateTextBoxSelection(textBoxes, null))
          setSelectedTextBoxId(null)

          const newTextBox = createAnchorFromClick(coords)
          setTextBoxes((prev) => [...prev, newTextBox])
          setSelectedTextBoxId(newTextBox.id)
          setTextInputValue("")
          setShowTextInput(true)
        }
      }
    },
    [textBoxes, selectedTextBoxId],
  )

  /**
   * マウスムーブイベントハンドラー（ドラッグでアンカー移動）
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent, zoom: number): void => {
      if (!isDraggingAnchor || !selectedTextBoxId) return

      const canvas = e.currentTarget as HTMLCanvasElement
      const coords = getCanvasCoordinates(e.clientX, e.clientY, canvas, zoom)

      // 選択されたアンカーを移動
      setTextBoxes((prev) =>
        prev.map((textBox) =>
          textBox.id === selectedTextBoxId
            ? { ...textBox, x: coords.x, y: coords.y }
            : textBox,
        ),
      )
    },
    [isDraggingAnchor, selectedTextBoxId],
  )

  /**
   * マウスアップイベントハンドラー
   */
  const handleMouseUp = useCallback((): void => {
    setCurrentDrag(null)
    setIsDraggingAnchor(false)
  }, [])

  /**
   * テキスト入力送信処理
   */
  const handleTextSubmit = useCallback((): void => {
    if (!textInputValue.trim() || !selectedTextBoxId) {
      setShowTextInput(false)
      setTextInputValue("")
      return
    }

    setTextBoxes(
      updateTextBoxContent(textBoxes, selectedTextBoxId, textInputValue),
    )
    setShowTextInput(false)
    setTextInputValue("")
  }, [textInputValue, selectedTextBoxId, textBoxes])

  /**
   * テキスト入力キャンセル処理
   */
  const handleTextCancel = useCallback((): void => {
    setShowTextInput(false)
    setTextInputValue("")
  }, [])

  /**
   * 選択されたテキストボックスを取得
   */
  const getSelectedTextBox = useCallback((): TextBox | null => {
    if (!selectedTextBoxId) return null
    return textBoxes.find((tb) => tb.id === selectedTextBoxId) || null
  }, [textBoxes, selectedTextBoxId])

  /**
   * テキストボックスのアンカー方向を更新
   */
  const updateTextBoxAnchorDirection = useCallback(
    (id: string, anchorDirection: AnchorDirection): void => {
      setTextBoxes((prev) =>
        prev.map((textBox) =>
          textBox.id === id ? { ...textBox, anchorDirection } : textBox,
        ),
      )
    },
    [],
  )

  /**
   * テキストボックスのサイズを更新
   */
  const updateTextBoxSize = useCallback(
    (id: string, textSize: number): void => {
      const clampedSize = Math.max(
        TEXTBOX_SETTINGS.MIN_TEXT_SIZE,
        Math.min(TEXTBOX_SETTINGS.MAX_TEXT_SIZE, textSize),
      )
      setTextBoxes((prev) =>
        prev.map((textBox) =>
          textBox.id === id ? { ...textBox, textSize: clampedSize } : textBox,
        ),
      )
    },
    [],
  )

  return {
    // 状態
    textBoxes,
    selectedTextBoxId,
    currentDrag,
    isCreatingAnchor,
    isDraggingAnchor,
    showTextInput,
    textInputValue,
    setTextInputValue,

    // 操作メソッド
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTextSubmit,
    handleTextCancel,
    getSelectedTextBox,
    updateTextBoxAnchorDirection,
    updateTextBoxSize,

    // 直接操作
    setTextBoxes,
    setSelectedTextBoxId,
  }
}
