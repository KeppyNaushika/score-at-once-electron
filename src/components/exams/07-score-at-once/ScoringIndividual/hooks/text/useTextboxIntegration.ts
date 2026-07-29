/**
 * @fileoverview テキストボックスCanvas統合フック
 * @description 個別採点画面でテキストボックス機能を使用するためのフック
 */

import { useCallback, useState } from "react"

import {
  drawingElementToTextBox,
  textBoxToDrawingElement,
} from "@/lib/textbox-canvas/coordinateConversion"
import type { TextBox } from "@/lib/textbox-canvas/types"
import type { AnchorDirection } from "@/types/drawingAnnotation.types"

import { DEFAULT_DRAWING_SETTINGS } from "../../constants/drawingConstants"
import type { DrawingElement } from "../../types"

interface UseTextboxIntegrationProps {
  /** Canvas/画像の幅（px） */
  canvasWidth: number
  /** Canvas/画像の高さ（px） */
  canvasHeight: number
  /** 現在の描画要素配列 */
  drawingElements: DrawingElement[]
  /** 描画要素更新関数（直接state更新用、非推奨） */
  updateDrawingElements: (elements: DrawingElement[]) => void
  /** 新規描画要素追加関数（DB永続化対応） */
  addDrawingElement?: (element: DrawingElement) => void | Promise<void>
  /** 描画要素更新関数（DB永続化対応） */
  updateDrawingElement?: (
    id: string,
    updates: Partial<DrawingElement>
  ) => void | Promise<void>
}

interface UseTextboxIntegrationReturn {
  /** テキスト編集モーダルの表示状態 */
  showTextboxModal: boolean
  /** テキスト編集モーダルを開く */
  openTextboxModal: (
    position: { x: number; y: number },
    initialText?: string,
    elementId?: string
  ) => void
  /** テキスト編集モーダルを閉じる */
  closeTextboxModal: () => void
  /** 現在編集中のテキスト値 */
  currentTextValue: string
  /** テキスト値を更新 */
  setCurrentTextValue: (value: string) => void
  /** 現在のテキスト色 */
  currentTextColor: string
  /** テキスト色を更新 */
  setCurrentTextColor: (color: string) => void
  /** 現在のモーダル位置（0-1座標系） */
  currentPosition: { x: number; y: number }
  /** 現在のフォントサイズ */
  currentFontSize: number
  /** フォントサイズを更新 */
  setCurrentFontSize: (size: number) => void
  /** 現在のアンカー方向 */
  currentAnchorDirection: AnchorDirection
  /** アンカー方向を更新 */
  setCurrentAnchorDirection: (direction: AnchorDirection) => void
  /** テキストを確定してDrawingElementとして追加/更新 */
  confirmText: () => void
  /** 編集をキャンセル */
  cancelEdit: () => void
  /** DrawingElementをTextBoxに変換 */
  convertToTextBox: (element: DrawingElement) => TextBox | null
  /** TextBoxをDrawingElementに変換 */
  convertToDrawingElement: (textBox: TextBox) => DrawingElement
}

/** 個別採点画面でテキストボックスの追加・編集・座標変換を統合するフック */
export function useTextboxIntegration({
  canvasWidth,
  canvasHeight,
  drawingElements,
  updateDrawingElements,
  addDrawingElement,
  updateDrawingElement,
}: UseTextboxIntegrationProps): UseTextboxIntegrationReturn {
  // モーダル表示状態
  const [showTextboxModal, setShowTextboxModal] = useState(false)
  const [currentTextValue, setCurrentTextValue] = useState("")
  const [currentTextColor, setCurrentTextColor] = useState("#ef4444")
  const [currentPosition, setCurrentPosition] = useState({ x: 0.5, y: 0.5 })
  const [currentFontSize, setCurrentFontSize] = useState<number>(
    DEFAULT_DRAWING_SETTINGS.fontSize
  )
  const [currentAnchorDirection, setCurrentAnchorDirection] =
    useState<AnchorDirection>("top-left")
  const [editingElementId, setEditingElementId] = useState<string | null>(null)

  // テキスト編集モーダルを開く
  const openTextboxModal = useCallback(
    (
      position: { x: number; y: number },
      initialText: string = "",
      elementId?: string
    ) => {
      setCurrentPosition(position)
      setCurrentTextValue(initialText)
      setEditingElementId(elementId || null)

      // 既存要素を編集する場合、その要素のfontSizeとanchorDirectionを取得
      if (elementId) {
        const existingElement = drawingElements.find(
          (element) => element.id === elementId
        )
        if (existingElement && existingElement.type === "text") {
          setCurrentFontSize(
            existingElement.fontSize ?? DEFAULT_DRAWING_SETTINGS.fontSize
          )
          setCurrentAnchorDirection(
            existingElement.anchorDirection ?? "top-left"
          )
        }
      } else {
        // 新規の場合はデフォルト値
        setCurrentFontSize(DEFAULT_DRAWING_SETTINGS.fontSize)
        setCurrentAnchorDirection("top-left")
      }

      setShowTextboxModal(true)
    },
    [drawingElements]
  )

  // テキスト編集モーダルを閉じる
  const closeTextboxModal = useCallback(() => {
    setShowTextboxModal(false)
    setCurrentTextValue("")
    setCurrentTextColor("#000000")
    setCurrentFontSize(DEFAULT_DRAWING_SETTINGS.fontSize)
    setCurrentAnchorDirection("top-left")
    setEditingElementId(null)
  }, [])

  // テキストを確定してDrawingElementとして追加/更新
  const confirmText = useCallback(async () => {
    if (!currentTextValue.trim()) {
      closeTextboxModal()
      return
    }

    if (editingElementId) {
      // 既存要素の更新
      if (updateDrawingElement) {
        // DB永続化対応の更新関数を使用
        await updateDrawingElement(editingElementId, {
          text: currentTextValue,
          color: currentTextColor,
          x: currentPosition.x,
          y: currentPosition.y,
          fontSize: currentFontSize,
          anchorDirection: currentAnchorDirection,
        })
      } else {
        // フォールバック: 直接state更新
        const updatedElements = drawingElements.map((element) => {
          if (element.id === editingElementId && element.type === "text") {
            return {
              ...element,
              text: currentTextValue,
              color: currentTextColor,
              x: currentPosition.x,
              y: currentPosition.y,
              fontSize: currentFontSize,
              anchorDirection: currentAnchorDirection,
            }
          }
          return element
        })
        updateDrawingElements(updatedElements)
      }
    } else {
      // 新規要素の追加
      const newElement: DrawingElement = {
        id: crypto.randomUUID(),
        type: "text",
        x: currentPosition.x,
        y: currentPosition.y,
        text: currentTextValue,
        color: currentTextColor,
        strokeWidth: 1,
        fontSize: currentFontSize,
        anchorDirection: currentAnchorDirection,
      }

      if (addDrawingElement) {
        // DB永続化対応の追加関数を使用
        await addDrawingElement(newElement)
      } else {
        // フォールバック: 直接state更新
        updateDrawingElements([...drawingElements, newElement])
      }
    }

    closeTextboxModal()
  }, [
    currentTextValue,
    currentTextColor,
    currentPosition,
    currentFontSize,
    currentAnchorDirection,
    editingElementId,
    drawingElements,
    updateDrawingElements,
    addDrawingElement,
    updateDrawingElement,
    closeTextboxModal,
  ])

  // 編集をキャンセル
  const cancelEdit = useCallback(() => {
    closeTextboxModal()
  }, [closeTextboxModal])

  // DrawingElementをTextBoxに変換
  const convertToTextBox = useCallback(
    (element: DrawingElement): TextBox | null => {
      if (element.type !== "text" || !element.text) {
        return null
      }

      return drawingElementToTextBox(
        {
          id: element.id,
          x: element.x,
          y: element.y,
          text: element.text,
          fontSize: element.fontSize,
          color: element.color,
        },
        { canvasWidth, canvasHeight }
      )
    },
    [canvasWidth, canvasHeight]
  )

  // TextBoxをDrawingElementに変換
  const convertToDrawingElement = useCallback(
    (textBox: TextBox): DrawingElement => {
      const drawingElementData = textBoxToDrawingElement(textBox, {
        canvasWidth,
        canvasHeight,
      })

      return {
        id: drawingElementData.id,
        type: drawingElementData.type,
        x: drawingElementData.x,
        y: drawingElementData.y,
        text: drawingElementData.text,
        color: drawingElementData.color,
        strokeWidth: 1,
        fontSize: drawingElementData.fontSize,
      }
    },
    [canvasWidth, canvasHeight]
  )

  return {
    showTextboxModal,
    openTextboxModal,
    closeTextboxModal,
    currentTextValue,
    setCurrentTextValue,
    currentTextColor,
    setCurrentTextColor,
    currentPosition,
    currentFontSize,
    setCurrentFontSize,
    currentAnchorDirection,
    setCurrentAnchorDirection,
    confirmText,
    cancelEdit,
    convertToTextBox,
    convertToDrawingElement,
  }
}
