/**
 * 解答用紙作成機能のIPCハンドラー
 */

import { dialog, ipcMain } from "electron"

import type {
  AnswerSheetDefinition,
  ASBConvertToProjectArgs,
  ASBExportPdfArgs,
  ASBExportPngArgs,
} from "../../types/answerSheetBuilder.types"
import {
  deleteDefinition,
  listDefinitions,
  loadDefinition,
  saveDefinition,
} from "../lib/answer-sheet-builder/definitionStorage"
import { generatePdf } from "../lib/answer-sheet-builder/pdfGenerator"
import { generatePng } from "../lib/answer-sheet-builder/pngGenerator"
import { convertToProject } from "../lib/answer-sheet-builder/projectConverter"

export function setupAnswerSheetBuilderHandlers(): void {
  // 定義一覧取得
  ipcMain.handle("asb:list-definitions", async () => {
    try {
      return { success: true, data: listDefinitions() }
    } catch (error) {
      console.error("asb:list-definitions error:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "定義一覧の取得に失敗しました",
      }
    }
  })

  // 定義読込
  ipcMain.handle("asb:load-definition", async (_event, id: string) => {
    try {
      const definition = loadDefinition(id)
      if (!definition) {
        return { success: false, error: "定義が見つかりません" }
      }
      return { success: true, data: definition }
    } catch (error) {
      console.error("asb:load-definition error:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "定義の読込に失敗しました",
      }
    }
  })

  // 定義保存
  ipcMain.handle(
    "asb:save-definition",
    async (_event, definition: AnswerSheetDefinition) => {
      try {
        saveDefinition(definition)
        return { success: true }
      } catch (error) {
        console.error("asb:save-definition error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "定義の保存に失敗しました",
        }
      }
    }
  )

  // 定義削除
  ipcMain.handle("asb:delete-definition", async (_event, id: string) => {
    try {
      const deleted = deleteDefinition(id)
      return { success: deleted }
    } catch (error) {
      console.error("asb:delete-definition error:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "定義の削除に失敗しました",
      }
    }
  })

  // PDF出力
  ipcMain.handle("asb:export-pdf", async (_event, args: ASBExportPdfArgs) => {
    try {
      await generatePdf(args.definition, args.outputPath)
      return { success: true, filePath: args.outputPath }
    } catch (error) {
      console.error("asb:export-pdf error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "PDF出力に失敗しました",
      }
    }
  })

  // PNG出力
  ipcMain.handle("asb:export-png", async (_event, args: ASBExportPngArgs) => {
    try {
      await generatePng(
        args.definition,
        args.outputPath,
        args.dpi,
        args.svgString
      )
      return { success: true, filePath: args.outputPath }
    } catch (error) {
      console.error("asb:export-png error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "PNG出力に失敗しました",
      }
    }
  })

  // 保存先ダイアログ
  ipcMain.handle(
    "asb:select-save-path",
    async (_event, options: { type: "pdf" | "png"; defaultName?: string }) => {
      try {
        const filters =
          options.type === "pdf"
            ? [{ name: "PDF", extensions: ["pdf"] }]
            : [{ name: "PNG", extensions: ["png"] }]

        const result = await dialog.showSaveDialog({
          title: `解答用紙を${options.type.toUpperCase()}として保存`,
          defaultPath: options.defaultName,
          filters,
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }
        return { success: true, filePath: result.filePath }
      } catch (error) {
        console.error("asb:select-save-path error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "保存先選択に失敗しました",
        }
      }
    }
  )

  // プロジェクト変換
  ipcMain.handle(
    "asb:convert-to-project",
    async (_event, args: ASBConvertToProjectArgs) => {
      try {
        const result = await convertToProject(
          args.definition,
          args.userId,
          args.svgString
        )
        return result
      } catch (error) {
        console.error("asb:convert-to-project error:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "プロジェクト変換に失敗しました",
        }
      }
    }
  )
}
