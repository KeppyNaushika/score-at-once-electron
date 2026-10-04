/**
 * 解答用紙作成機能のIPCハンドラー
 */

import { dialog } from "electron"
import * as fs from "fs"
import * as path from "path"

import type {
  ASBConvertToExamArgs,
  ASBDeleteImageArgs,
  ASBExportPngArgs,
  ASBUploadImageArgs,
} from "../../src/types/answerSheetBuilder.types"
import type {
  AnswerSheetDefinition,
  ManuscriptPaper,
} from "../../src/types/answerSheetDefinition.types"
import { convertToExam } from "../lib/answer-sheet-builder/examConverter"
import {
  getAbsolutePathFromSharedFiles,
  getAsbImagesDirectory,
  getRelativePathFromSharedFiles,
} from "../lib/dataManager"
import { importAsbDefinition } from "../lib/import/asb-archive"
import { htmlToPngBuffer } from "../lib/printUtils"
import {
  deleteAsbDefinition,
  getAsbDefinition,
  getAsbDefinitionOwner,
  listAsbDefinitions,
  transferAsbDefinitionOwner,
} from "../lib/prisma/asbDefinition"
import { replaceAsbDefinition } from "../lib/prisma/asbDefinitionReplace"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 解答用紙作成機能のIPCチャンネル（定義CRUD・画像管理・PNG出力・インポート/エクスポート）を登録する */
export const answerSheetBuilderHandlers = {
  // 担当者（編集できる唯一の利用者）
  "asb:get-owner": async (id: string) => {
    return await getAsbDefinitionOwner(id)
  },

  // 担当の受け渡し（渡せるのは今の担当者だけ）
  "asb:transfer-owner": async (
    id: string,
    currentUserId: string,
    nextUserId: string
  ) => {
    return await transferAsbDefinitionOwner(id, currentUserId, nextUserId)
  },

  // 一覧取得（閲覧は全員。編集できるのは担当者だけ）
  "asb:list-definitions": async () => {
    return await listAsbDefinitions()
  },

  // 定義読込
  "asb:load-definition": async (id: string) => {
    const definition = await getAsbDefinition(id)
    if (!definition) {
      throw new Error("解答用紙が見つかりません")
    }
    return definition
  },

  // 定義まるごとの置き換え。**日常の編集をここへ流さない**（1件ずつの書き込みへ）。
  // 通すのは新規作成・undo/redo・複製・アーカイブ取り込みの4経路だけで、どれも
  // 「全体を指定する」ことに意味がある
  "asb:replace-definition": async (
    definition: AnswerSheetDefinition,
    ownerUserId: string
  ) => {
    await replaceAsbDefinition(definition, ownerUserId)
  },

  // 1件ずつの書き込み（実体 × 操作）は `asbEditHandlers.ts`

  // 定義削除（画像ディレクトリも削除）
  "asb:delete-definition": async (id: string, userId: string) => {
    const deleted = await deleteAsbDefinition(id, userId)
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
    if (!deleted) {
      throw new Error("解答用紙が見つかりません")
    }
  },

  // 画像アップロード
  "asb:upload-image": async (args: ASBUploadImageArgs) => {
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
    const relativePath = getRelativePathFromSharedFiles(destPath)
    return relativePath
  },

  // 画像削除
  "asb:delete-image": async (args: ASBDeleteImageArgs) => {
    const absolutePath = getAbsolutePathFromSharedFiles(args.imagePath)
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath)
    }
  },

  // PNG出力: HTML文字列を受け取り → BrowserWindow + capturePage でラスタライズ
  "asb:export-png": async (args: ASBExportPngArgs) => {
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

    return args.outputPath
  },

  // 保存先ダイアログ
  "asb:select-save-path": async (options: {
    type: "pdf" | "png"
    defaultName?: string
  }) => {
    const filters =
      options.type === "pdf"
        ? [{ name: "PDF", extensions: ["pdf"] }]
        : [{ name: "PNG", extensions: ["png"] }]

    const result = await dialog.showSaveDialog({
      title: `解答用紙を${options.type.toUpperCase()}として保存`,
      defaultPath: options.defaultName,
      filters,
    })

    // 選ばずに閉じたのは失敗ではない
    if (result.canceled || !result.filePath) return { canceled: true as const }
    return { canceled: false as const, filePath: result.filePath }
  },

  // 試験変換: multiPageLayout + HTML文字列を受け取り
  "asb:convert-to-exam": async (args: ASBConvertToExamArgs) => {
    const result = await convertToExam(
      args.definition,
      args.userId,
      args.multiPageLayout,
      args.answerSheetHtmlPages,
      args.modelAnswerHtmlPages
    )
    return result
  },

  // 定義インポート（.asb。旧形式は読み込みだけ残して凍結。ファイルは一覧の「読み込み」で選ぶ）
  "asb:import-definition": async (filePath: string, userId: string) => {
    return await importAsbDefinition(filePath, userId)
  },

  // 定義複製（画像ファイルもコピー）
  "asb:duplicate-definition": async (id: string, userId: string) => {
    const definition = await getAsbDefinition(id)
    if (!definition) {
      throw new Error("解答用紙が見つかりません")
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
        const absoluteSrc = getAbsolutePathFromSharedFiles(
          imageElement.imagePath
        )
        if (fs.existsSync(absoluteSrc)) {
          const filename = path.basename(imageElement.imagePath)
          const destPath = path.join(newImagesDir, filename)
          fs.copyFileSync(absoluteSrc, destPath)
          newImagePath = getRelativePathFromSharedFiles(destPath)
        }
      }
      return {
        ...imageElement,
        id: crypto.randomUUID(),
        imagePath: newImagePath,
      }
    }

    // 原稿用紙と文字位置マーカーは別テーブルの行なので、ここで id を振り直さないと
    // 元の id を引き継いだまま作成しようとして主キーが衝突する。画像ディレクトリの
    // 作成とコピーは先に走るため、トランザクションが巻き戻っても孤児のファイルが
    // 残る
    const copyManuscriptPaper = (
      manuscriptPaper: ManuscriptPaper
    ): ManuscriptPaper => ({
      ...manuscriptPaper,
      id: crypto.randomUUID(),
      charGuides: manuscriptPaper.charGuides.map((charGuide) => ({
        ...charGuide,
        id: crypto.randomUUID(),
      })),
    })

    const regeneratedMajorQuestions = definition.majorQuestions.map(
      (majorQuestion) => ({
        ...majorQuestion,
        id: crypto.randomUUID(),
        subQuestions: majorQuestion.subQuestions.map((subQuestion) => ({
          ...subQuestion,
          id: crypto.randomUUID(),
          manuscriptPaper:
            subQuestion.manuscriptPaper &&
            copyManuscriptPaper(subQuestion.manuscriptPaper),
          textElements: subQuestion.textElements.map((textElement) => ({
            ...textElement,
            id: crypto.randomUUID(),
          })),
          imageElements: subQuestion.imageElements?.map(copyImageElement),
          branchQuestions: subQuestion.branchQuestions.map(
            (branchQuestion) => ({
              ...branchQuestion,
              id: crypto.randomUUID(),
              manuscriptPaper:
                branchQuestion.manuscriptPaper &&
                copyManuscriptPaper(branchQuestion.manuscriptPaper),
              textElements: branchQuestion.textElements.map((textElement) => ({
                ...textElement,
                id: crypto.randomUUID(),
              })),
              imageElements:
                branchQuestion.imageElements?.map(copyImageElement),
            })
          ),
        })),
      })
    )

    // 既存の名前と重複しないようサフィックス付与
    const existing = await listAsbDefinitions()
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
      // 複製元の日時は引き継がない。保存時に DB が採番した値を
      // dbToDefinition が載せ直すため、ここでは持たない。
      createdAt: undefined,
      updatedAt: undefined,
    }

    await replaceAsbDefinition(duplicated, userId)
    return newId
  },
} satisfies HandlerMap
