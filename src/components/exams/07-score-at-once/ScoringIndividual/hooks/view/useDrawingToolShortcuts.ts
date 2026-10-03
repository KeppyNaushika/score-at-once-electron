/**
 * @fileoverview 描画ツールキーボードショートカットフック
 * 描画ツール切り替えおよび表示制御のキーボードショートカットを定義
 */
import { useCallback } from "react"

import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

import type { CanvasTool } from "../../types"

/** 描画ツールキーボードショートカットフックのパラメータ */
interface UseDrawingToolShortcutsParams {
  /** 現在のツール設定関数 */
  setCurrentTool: (tool: CanvasTool) => void
  /** 全体表示ハンドラー */
  handleMaximizeView: () => void
  /** 設問表示ハンドラー */
  handleCropView: () => void
}

/**
 * 描画ツールキーボードショートカットフック
 *
 * @description
 * 描画ツールの切り替えおよび表示制御のキーボードショートカットを登録するフック。
 * 個別採点モード（gradingMode == 'individual'）でのみ有効。
 *
 * @param params - フックパラメータ
 */
export function useDrawingToolShortcuts({
  setCurrentTool,
  handleMaximizeView,
  handleCropView,
}: UseDrawingToolShortcutsParams): void {
  // ============================================
  // 表示制御のキーボードショートカット
  // ============================================

  // 全体表示（個別モード専用）。ほかのキーと同じく、文字の書き込み中（textEditorActive）は効かない
  useSceneCommand("view.fullView", handleMaximizeView, {
    condition: "gradingMode == 'individual'",
    metadata: {
      title: "全体表示",
      category: "表示制御",
      description: "個別採点時にページ全体を表示します",
    },
  })

  // 設問表示（個別モード専用）
  useSceneCommand("view.questionView", handleCropView, {
    condition: "gradingMode == 'individual'",
    metadata: {
      title: "設問表示",
      category: "表示制御",
      description: "個別採点時に設問領域をフィットして表示します",
    },
  })

  // ============================================
  // 描画ツールのキーボードショートカット
  // ============================================

  // ハンドツール
  useSceneCommand(
    "tool.hand",
    useCallback(() => setCurrentTool("hand"), [setCurrentTool]),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "ハンドツール",
        category: "描画ツール",
        description: "画面のパン操作を行います",
      },
    }
  )

  // 選択ツール
  useSceneCommand(
    "tool.select",
    useCallback(() => setCurrentTool("select"), [setCurrentTool]),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "選択ツール",
        category: "描画ツール",
        description: "図形を選択・移動・編集します",
      },
    }
  )

  // テキストツール
  useSceneCommand(
    "tool.text",
    useCallback(() => setCurrentTool("text"), [setCurrentTool]),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "テキストツール",
        category: "描画ツール",
        description: "テキストを追加します",
      },
    }
  )

  // 線ツール
  useSceneCommand(
    "tool.line",
    useCallback(() => setCurrentTool("line"), [setCurrentTool]),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "線ツール",
        category: "描画ツール",
        description: "直線を描画します",
      },
    }
  )

  // 矩形ツール
  useSceneCommand(
    "tool.rectangle",
    useCallback(() => setCurrentTool("rectangle"), [setCurrentTool]),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "矩形ツール",
        category: "描画ツール",
        description: "矩形を描画します",
      },
    }
  )

  // 楕円ツール
  useSceneCommand(
    "tool.ellipse",
    useCallback(() => setCurrentTool("ellipse"), [setCurrentTool]),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "楕円ツール",
        category: "描画ツール",
        description: "楕円・円を描画します",
      },
    }
  )
}
