/**
 * セルの中身（テキスト・画像・OMR 設定・原稿用紙・文字位置マーカー）の編集の意図を
 * 組み立てる。
 *
 * 中身はどれも小問か枝問のセルにぶら下がる。id は解答用紙の中で一意なので、更新と
 * 削除は親を知らなくてよい。状態へ当てて書き込みへ渡すのは受け取った `edit`。
 */

import type { RefObject } from "react"
import { useCallback, useMemo } from "react"

import type {
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  AsbCellParent,
  AsbCharGuideAttributes,
  AsbImageElementAttributes,
  AsbManuscriptPaperSettings,
  AsbTextElementAttributes,
  CellImageElement,
  ManuscriptCharGuide,
} from "@/types/answerSheetDefinition.types"
import type { OMRCellConfig } from "@/types/omr.types"

import { createDefaultTextElement, generateId } from "../../constants"
import type { AsbEditorActions } from "../../types"
import { allCells, findCell } from "./definitionLookup"
import {
  charGuideAttributes,
  imageElementAttributes,
  manuscriptPaperSettings,
  textElementAttributes,
} from "./entityAttributes"

type CellContentEditActions = Pick<
  AsbEditorActions,
  | "addTextElement"
  | "updateTextElement"
  | "deleteTextElement"
  | "addImageElement"
  | "updateImageElement"
  | "deleteImageElement"
  | "upsertOmrConfig"
  | "deleteOmrConfig"
  | "setManuscriptPaperEnabled"
  | "updateManuscriptPaper"
  | "addCharGuide"
  | "updateCharGuide"
  | "deleteCharGuide"
>

interface UseCellContentEditActionsOptions {
  /** いまの編集内容（最新の値を読むだけ。依存に置くと操作が毎回別物になる） */
  definitionRef: RefObject<AnswerSheetDefinition>
  /** 編集を状態へ当て、同じ意図を書き込みへ渡す */
  edit: (action: AnswerSheetEditAction) => void
}

/** セルの中身の追加・更新・削除 */
export function useCellContentEditActions({
  definitionRef,
  edit,
}: UseCellContentEditActionsOptions): CellContentEditActions {
  // ---------- テキスト・画像・OMR ----------

  const addTextElement = useCallback(
    (parent: AsbCellParent) =>
      edit({
        type: "ADD_TEXT_ELEMENT",
        payload: { parent, textElement: createDefaultTextElement() },
      }),
    [edit]
  )

  const updateTextElement = useCallback(
    (textElementId: string, data: Partial<AsbTextElementAttributes>) => {
      const textElement = allCells(definitionRef.current)
        .flatMap((cell) => cell.textElements)
        .find((candidate) => candidate.id === textElementId)
      if (!textElement) return
      edit({
        type: "UPDATE_TEXT_ELEMENT",
        payload: {
          textElementId,
          attributes: { ...textElementAttributes(textElement), ...data },
        },
      })
    },
    [definitionRef, edit]
  )

  const deleteTextElement = useCallback(
    (textElementId: string) =>
      edit({ type: "DELETE_TEXT_ELEMENT", payload: { textElementId } }),
    [edit]
  )

  const addImageElement = useCallback(
    (parent: AsbCellParent, imageElement: CellImageElement) =>
      edit({
        type: "ADD_IMAGE_ELEMENT",
        payload: { parent, imageElement },
      }),
    [edit]
  )

  const updateImageElement = useCallback(
    (imageElementId: string, data: Partial<AsbImageElementAttributes>) => {
      const imageElement = allCells(definitionRef.current)
        .flatMap((cell) => cell.imageElements ?? [])
        .find((candidate) => candidate.id === imageElementId)
      if (!imageElement) return
      edit({
        type: "UPDATE_IMAGE_ELEMENT",
        payload: {
          imageElementId,
          attributes: { ...imageElementAttributes(imageElement), ...data },
        },
      })
    },
    [definitionRef, edit]
  )

  const deleteImageElement = useCallback(
    (imageElementId: string) =>
      edit({ type: "DELETE_IMAGE_ELEMENT", payload: { imageElementId } }),
    [edit]
  )

  const upsertOmrConfig = useCallback(
    (parent: AsbCellParent, config: OMRCellConfig) =>
      edit({ type: "UPSERT_OMR_CONFIG", payload: { parent, config } }),
    [edit]
  )

  const deleteOmrConfig = useCallback(
    (parent: AsbCellParent) =>
      edit({ type: "DELETE_OMR_CONFIG", payload: { parent } }),
    [edit]
  )

  // ---------- 原稿用紙 ----------

  /**
   * セルが原稿用紙を使うかどうかを切り替える。**行が無ければ作る**。
   *
   * まだ原稿用紙が無いセルでは、**ここで新しい id を振る**（reducer の中で作ると、その
   * id を知れず対応する書き込みを組み立てられない）。列数などの既定は用紙設定から決まる
   * ので**画面が渡す**（`initialSettings`）。reducer も main もその値で作る — 別々の既定
   * 値を持つと、画面が見せた姿と DB の行が食い違う。
   */
  const setManuscriptPaperEnabled = useCallback(
    (
      parent: AsbCellParent,
      enabled: boolean,
      initialSettings: AsbManuscriptPaperSettings
    ) => {
      const cell = findCell(definitionRef.current, parent)
      if (!cell) return
      edit({
        type: "SET_MANUSCRIPT_PAPER_ENABLED",
        payload: {
          parent,
          manuscriptPaperId: cell.manuscriptPaper?.id ?? generateId(),
          enabled,
          initialSettings,
        },
      })
    },
    [definitionRef, edit]
  )

  /**
   * 原稿用紙の設定を書く。**行が在るときだけ**（設定の欄はオンのときしか出ない）。
   *
   * 画面は「列数だけ」「ガイドの位置だけ」を触るので、足りない設定はいまの姿から埋める。
   * `enabled` はここに入らない — 切り替えは別の意図である。
   */
  const updateManuscriptPaper = useCallback(
    (manuscriptPaperId: string, data: Partial<AsbManuscriptPaperSettings>) => {
      const manuscriptPaper = allCells(definitionRef.current)
        .map((cell) => cell.manuscriptPaper)
        .find((candidate) => candidate?.id === manuscriptPaperId)
      if (!manuscriptPaper) return
      edit({
        type: "UPDATE_MANUSCRIPT_PAPER",
        payload: {
          manuscriptPaperId,
          attributes: { ...manuscriptPaperSettings(manuscriptPaper), ...data },
        },
      })
    },
    [definitionRef, edit]
  )

  // ---------- 文字位置マーカー ----------

  const addCharGuide = useCallback(
    (manuscriptPaperId: string, charGuide: ManuscriptCharGuide) =>
      edit({
        type: "ADD_CHAR_GUIDE",
        payload: { manuscriptPaperId, charGuide },
      }),
    [edit]
  )

  const updateCharGuide = useCallback(
    (charGuideId: string, data: Partial<AsbCharGuideAttributes>) => {
      const charGuide = allCells(definitionRef.current)
        .flatMap((cell) => cell.manuscriptPaper?.charGuides ?? [])
        .find((candidate) => candidate.id === charGuideId)
      if (!charGuide) return
      edit({
        type: "UPDATE_CHAR_GUIDE",
        payload: {
          charGuideId,
          attributes: { ...charGuideAttributes(charGuide), ...data },
        },
      })
    },
    [definitionRef, edit]
  )

  const deleteCharGuide = useCallback(
    (charGuideId: string) =>
      edit({ type: "DELETE_CHAR_GUIDE", payload: { charGuideId } }),
    [edit]
  )

  return useMemo(
    () => ({
      addTextElement,
      updateTextElement,
      deleteTextElement,
      addImageElement,
      updateImageElement,
      deleteImageElement,
      upsertOmrConfig,
      deleteOmrConfig,
      setManuscriptPaperEnabled,
      updateManuscriptPaper,
      addCharGuide,
      updateCharGuide,
      deleteCharGuide,
    }),
    [
      addTextElement,
      updateTextElement,
      deleteTextElement,
      addImageElement,
      updateImageElement,
      deleteImageElement,
      upsertOmrConfig,
      deleteOmrConfig,
      setManuscriptPaperEnabled,
      updateManuscriptPaper,
      addCharGuide,
      updateCharGuide,
      deleteCharGuide,
    ]
  )
}
