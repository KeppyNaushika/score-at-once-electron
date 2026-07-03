/**
 * 解答用紙作成機能のIPCハンドラー
 */

import { BrowserWindow, dialog, ipcMain, shell } from "electron"
import fs from "fs"
import os from "os"
import path from "path"

import type {
  ASBConvertToExamArgs,
  ASBDeleteImageArgs,
  ASBExportPdfArgs,
  ASBExportPngArgs,
  ASBPrintArgs,
  ASBUploadImageArgs,
} from "../../src/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "../../src/types/answerSheetDefinition.types"
import { convertToExam } from "../lib/answer-sheet-builder/examConverter"
import {
  getAbsolutePathFromData,
  getAsbImagesDirectory,
  getRelativePathFromData,
} from "../lib/dataManager"
import { exportAsbDefinition } from "../lib/export/asb-archive"
import {
  analyzeAsbArchive,
  importAsbDefinition,
} from "../lib/import/asb-archive"
import { htmlToPngBuffer } from "../lib/printUtils"
import {
  deleteAsbDefinition,
  getAsbDefinition,
  listAsbDefinitions,
  saveAsbDefinition,
} from "../lib/prisma/asbDefinition"
import { registerSafeHandler } from "./ipcHandlerUtils"

/** 解答用紙作成機能のIPCチャンネル（定義CRUD・画像管理・PDF/PNG出力・印刷・インポート/エクスポート）を登録する */
export function setupAnswerSheetBuilderHandlers(): void {
  // 定義一覧取得
  registerSafeHandler(
    "asb:list-definitions",
    async (userId: string) => {
      const data = await listAsbDefinitions(userId)
      return { success: true, data }
    },
    "定義一覧の取得に失敗しました"
  )

  // 定義読込
  registerSafeHandler(
    "asb:load-definition",
    async (id: string) => {
      const definition = await getAsbDefinition(id)
      if (!definition) {
        return { success: false, error: "定義が見つかりません" }
      }
      return { success: true, data: definition }
    },
    "定義の読込に失敗しました"
  )

  // 定義保存
  registerSafeHandler(
    "asb:save-definition",
    async (definition: AnswerSheetDefinition, userId: string) => {
      await saveAsbDefinition(definition, userId)
      return { success: true }
    },
    "定義の保存に失敗しました"
  )

  // 定義削除（画像ディレクトリも削除）
  registerSafeHandler(
    "asb:delete-definition",
    async (id: string) => {
      const deleted = await deleteAsbDefinition(id)
      if (deleted) {
        // 画像ディレクトリの削除
        const imagesDir = getAsbImagesDirectory(id)
        try {
          // ディレクトリの親（definitionId ディレクトリ）ごと削除
          const definitionDir = path.dirname(imagesDir)
          if (fs.existsSync(definitionDir)) {
            fs.rmSync(definitionDir, { recursive: true, force: true })
          }
        } catch (cleanupError) {
          console.warn(
            "asb:delete-definition image cleanup warning:",
            cleanupError
          )
        }
      }
      return { success: deleted }
    },
    "定義の削除に失敗しました"
  )

  // 画像アップロード
  registerSafeHandler(
    "asb:upload-image",
    async (args: ASBUploadImageArgs) => {
      const imagesDir = getAsbImagesDirectory(args.definitionId)
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }

      // ユニークなファイル名を生成
      const ext = path.extname(args.originalName)
      const baseName = path.basename(args.originalName, ext)
      const uniqueName = `${baseName}_${Date.now()}${ext}`
      const destPath = path.join(imagesDir, uniqueName)

      // ファイルコピー
      fs.copyFileSync(args.filePath, destPath)

      // data/ からの相対パスを返す
      const relativePath = getRelativePathFromData(destPath)
      return { success: true, imagePath: relativePath }
    },
    "画像のアップロードに失敗しました"
  )

  // 画像削除
  registerSafeHandler(
    "asb:delete-image",
    async (args: ASBDeleteImageArgs) => {
      const absolutePath = getAbsolutePathFromData(args.imagePath)
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath)
      }
      return { success: true }
    },
    "画像の削除に失敗しました"
  )

  // PDF出力: HTMLを受け取り → 一時ファイル → BrowserWindow → printToPDF
  // NOTE: Uses BrowserWindow with try-finally for cleanup, kept as manual ipcMain.handle
  ipcMain.handle("asb:export-pdf", async (_event, args: ASBExportPdfArgs) => {
    let tempHtmlPath: string | null = null
    let win: BrowserWindow | null = null
    try {
      tempHtmlPath = path.join(os.tmpdir(), `asb-pdf-${Date.now()}.html`)
      fs.writeFileSync(tempHtmlPath, args.html, "utf-8")

      win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true },
      })
      await win.loadFile(tempHtmlPath)

      // レンダリング完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 500))

      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: {
          width: args.pageWidthMm / 25.4, // mm → inches
          height: args.pageHeightMm / 25.4,
        },
        printBackground: true,
        margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 },
      })

      const outputDir = path.dirname(args.outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      fs.writeFileSync(args.outputPath, pdfBuffer)

      return { success: true, filePath: args.outputPath }
    } catch (error) {
      console.error("Error in IPC handler [asb:export-pdf]:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "PDF出力に失敗しました",
      }
    } finally {
      win?.destroy()
      if (tempHtmlPath) {
        try {
          fs.unlinkSync(tempHtmlPath)
        } catch {
          // ignore
        }
      }
    }
  })

  // PNG出力: HTML文字列を受け取り → BrowserWindow + capturePage でラスタライズ
  registerSafeHandler(
    "asb:export-png",
    async (args: ASBExportPngArgs) => {
      const outputDir = path.dirname(args.outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      if (args.htmlPages.length === 1) {
        const buf = await htmlToPngBuffer(
          args.htmlPages[0],
          args.pageWidthMm,
          args.pageHeightMm,
          args.dpi
        )
        fs.writeFileSync(args.outputPath, buf)
      } else {
        const ext = path.extname(args.outputPath)
        const base = args.outputPath.slice(0, -ext.length)
        for (let i = 0; i < args.htmlPages.length; i++) {
          const pagePath = `${base}-${i + 1}${ext}`
          const buf = await htmlToPngBuffer(
            args.htmlPages[i],
            args.pageWidthMm,
            args.pageHeightMm,
            args.dpi
          )
          fs.writeFileSync(pagePath, buf)
        }
      }

      return { success: true, filePath: args.outputPath }
    },
    "PNG出力に失敗しました"
  )

  // 保存先ダイアログ
  registerSafeHandler(
    "asb:select-save-path",
    async (options: { type: "pdf" | "png"; defaultName?: string }) => {
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
    },
    "保存先選択に失敗しました"
  )

  // 試験変換: multiPageLayout + HTML文字列を受け取り
  registerSafeHandler(
    "asb:convert-to-exam",
    async (args: ASBConvertToExamArgs) => {
      const result = await convertToExam(
        args.definition,
        args.userId,
        args.multiPageLayout,
        args.answerSheetHtmlPages,
        args.modelAnswerHtmlPages
      )
      return result
    },
    "試験変換に失敗しました"
  )

  // 印刷: HTMLを受け取り → printToPDF → プレビューで開く
  // NOTE: Uses BrowserWindow with try-finally for cleanup, kept as manual ipcMain.handle
  ipcMain.handle("asb:print", async (_event, args: ASBPrintArgs) => {
    let tempHtmlPath: string | null = null
    let tempPdfPath: string | null = null
    let win: BrowserWindow | null = null
    try {
      tempHtmlPath = path.join(os.tmpdir(), `asb-print-${Date.now()}.html`)
      tempPdfPath = path.join(os.tmpdir(), `asb-print-${Date.now()}.pdf`)
      fs.writeFileSync(tempHtmlPath, args.html, "utf-8")

      win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true },
      })
      await win.loadFile(tempHtmlPath)

      // レンダリング完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 500))

      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: {
          width: args.pageWidthMm / 25.4, // mm → inches
          height: args.pageHeightMm / 25.4,
        },
        printBackground: true,
        margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 },
      })

      fs.writeFileSync(tempPdfPath, pdfBuffer)
      await shell.openPath(tempPdfPath)

      return { success: true }
    } catch (error) {
      console.error("Error in IPC handler [asb:print]:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "印刷に失敗しました",
      }
    } finally {
      win?.destroy()
      if (tempHtmlPath) {
        try {
          fs.unlinkSync(tempHtmlPath)
        } catch {
          // ignore
        }
      }
      // tempPdfPath はプレビュー中なので削除しない
    }
  })

  // 定義のインポートファイル選択
  registerSafeHandler(
    "asb:select-import-file",
    async () => {
      const result = await dialog.showOpenDialog({
        title: "解答用紙定義を読み込み",
        filters: [{ name: "解答用紙定義", extensions: ["asb"] }],
        properties: ["openFile"],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      return { success: true, filePath: result.filePaths[0] }
    },
    "ファイル選択に失敗しました"
  )

  // アーカイブ分析（プレビュー用）
  registerSafeHandler(
    "asb:analyze-asb-archive",
    async (filePath: string) => {
      return await analyzeAsbArchive(filePath)
    },
    "アーカイブ分析に失敗しました"
  )

  // 定義エクスポート
  registerSafeHandler(
    "asb:export-definition",
    async (definitionId: string) => {
      return await exportAsbDefinition(definitionId)
    },
    "書き出しに失敗しました"
  )

  // 定義インポート
  registerSafeHandler(
    "asb:import-definition",
    async (filePath: string, userId: string) => {
      return await importAsbDefinition(filePath, userId)
    },
    "インポートに失敗しました"
  )

  // 定義複製（画像ファイルもコピー）
  registerSafeHandler(
    "asb:duplicate-definition",
    async (id: string, userId: string) => {
      const definition = await getAsbDefinition(id)
      if (!definition) {
        return { success: false, error: "定義が見つかりません" }
      }

      const newId = crypto.randomUUID()

      // 全子要素のIDを再生成
      const regeneratedHeaderFields = definition.settings.headerFields.map(
        (headerField) => ({ ...headerField, id: crypto.randomUUID() })
      )

      // 新定義の画像ディレクトリを作成
      const newImagesDir = getAsbImagesDirectory(newId)
      fs.mkdirSync(newImagesDir, { recursive: true })

      // 画像コピーとパス更新を行うヘルパー
      const copyImageElement = <T extends { id: string; imagePath: string }>(
        imageElement: T
      ): T => {
        let newImagePath = imageElement.imagePath
        if (imageElement.imagePath) {
          const absoluteSrc = getAbsolutePathFromData(imageElement.imagePath)
          if (fs.existsSync(absoluteSrc)) {
            const filename = path.basename(imageElement.imagePath)
            const destPath = path.join(newImagesDir, filename)
            fs.copyFileSync(absoluteSrc, destPath)
            newImagePath = getRelativePathFromData(destPath)
          }
        }
        return {
          ...imageElement,
          id: crypto.randomUUID(),
          imagePath: newImagePath,
        }
      }

      const regeneratedMajorQuestions = definition.majorQuestions.map(
        (majorQuestion) => ({
          ...majorQuestion,
          id: crypto.randomUUID(),
          subQuestions: majorQuestion.subQuestions.map((subQuestion) => ({
            ...subQuestion,
            id: crypto.randomUUID(),
            textElements: subQuestion.textElements.map((textElement) => ({
              ...textElement,
              id: crypto.randomUUID(),
            })),
            imageElements: subQuestion.imageElements?.map(copyImageElement),
            branchQuestions: subQuestion.branchQuestions.map(
              (branchQuestion) => ({
                ...branchQuestion,
                id: crypto.randomUUID(),
                textElements: branchQuestion.textElements.map(
                  (textElement) => ({
                    ...textElement,
                    id: crypto.randomUUID(),
                  })
                ),
                imageElements:
                  branchQuestion.imageElements?.map(copyImageElement),
              })
            ),
          })),
        })
      )

      // 既存の名前と重複しないようサフィックス付与
      const existing = await listAsbDefinitions(userId)
      const existingNames = new Set(
        existing.map((existingDefinition) => existingDefinition.name)
      )
      let newName = `${definition.name} (コピー)`
      if (existingNames.has(newName)) {
        let suffix = 2
        while (existingNames.has(`${definition.name} (コピー ${suffix})`)) {
          suffix++
        }
        newName = `${definition.name} (コピー ${suffix})`
      }

      const duplicated: AnswerSheetDefinition = {
        ...definition,
        id: newId,
        name: newName,
        settings: {
          ...definition.settings,
          headerFields: regeneratedHeaderFields,
        },
        majorQuestions: regeneratedMajorQuestions,
        createdAt: undefined as unknown as string,
        updatedAt: undefined as unknown as string,
      }

      await saveAsbDefinition(duplicated, userId)
      return { success: true, definitionId: newId }
    },
    "複製に失敗しました"
  )
}
