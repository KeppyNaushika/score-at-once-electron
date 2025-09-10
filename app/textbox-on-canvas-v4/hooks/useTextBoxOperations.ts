/**
 * @fileoverview テキストボックス操作カスタムフック
 * @description テキストボックスの作成・選択・編集操作を管理
 */

"use client"

import { useCallback, useState } from "react"
import type { TextBox, DragState } from "../types"
import {
  findTextBoxAtPoint,
  updateTextBoxSelection,
  updateTextBoxContent,
  isValidDragForTextBox,
  createTextBoxFromDrag
} from "../utils/coordinateUtils"
import { getCanvasCoordinates } from "../utils/coordinateUtils"

/**
 * テキストボックス操作フック
 */
export function useTextBoxOperations() {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [currentDrag, setCurrentDrag] = useState<DragState | null>(null)
  const [isCreatingTextBox, setIsCreatingTextBox] = useState<boolean>(false)

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
        // 新しいテキストボックスの作成開始
        setTextBoxes(updateTextBoxSelection(textBoxes, null))
        setSelectedTextBoxId(null)
        setIsCreatingTextBox(true)
        setCurrentDrag({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
        })
      }
    },
    [textBoxes, selectedTextBoxId]
  )

  /**
   * マウスムーブイベントハンドラー
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent, zoom: number): void => {
      if (!currentDrag || !isCreatingTextBox) return

      const canvas = e.currentTarget as HTMLCanvasElement
      const coords = getCanvasCoordinates(e.clientX, e.clientY, canvas, zoom)
      
      setCurrentDrag((prev) =>
        prev
          ? {
              ...prev,
              currentX: coords.x,
              currentY: coords.y,
            }
          : null,
      )
    },
    [currentDrag, isCreatingTextBox]
  )

  /**
   * マウスアップイベントハンドラー
   */
  const handleMouseUp = useCallback((): void => {
    if (currentDrag && isCreatingTextBox) {
      // 有効なサイズのテキストボックスのみ作成
      if (isValidDragForTextBox(currentDrag)) {
        const newTextBox = createTextBoxFromDrag(currentDrag)
        setTextBoxes((prev) => [...prev, newTextBox])
      }

      setCurrentDrag(null)
      setIsCreatingTextBox(false)
    }
  }, [currentDrag, isCreatingTextBox])

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
      updateTextBoxContent(textBoxes, selectedTextBoxId, textInputValue)
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
    return textBoxes.find(tb => tb.id === selectedTextBoxId) || null
  }, [textBoxes, selectedTextBoxId])

  return {
    // 状態
    textBoxes,
    selectedTextBoxId,
    currentDrag,
    isCreatingTextBox,
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

    // 直接操作
    setTextBoxes,
    setSelectedTextBoxId
  }
}