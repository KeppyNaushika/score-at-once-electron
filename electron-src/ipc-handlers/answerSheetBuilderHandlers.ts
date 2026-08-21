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
  AsbBranchQuestionAttributes,
  AsbCellParent,
  AsbCharGuideAttributes,
  AsbDefinitionAttributes,
  AsbHeaderFieldAttributes,
  AsbImageElementAttributes,
  AsbMajorQuestionAttributes,
  AsbManuscriptPaperSettings,
  AsbSubQuestionAttributes,
  AsbTextElementAttributes,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  HeaderFieldDefinition,
  LabelAssignment,
  LabelCategory,
  MajorQuestion,
  ManuscriptCharGuide,
  ManuscriptPaper,
  SubQuestion,
} from "../../src/types/answerSheetDefinition.types"
import type { OMRCellConfig } from "../../src/types/omr.types"
import { convertToExam } from "../lib/answer-sheet-builder/examConverter"
import {
  getAbsolutePathFromData,
  getAsbImagesDirectory,
  getRelativePathFromData,
} from "../lib/dataManager"
import { exportAsbDefinition } from "../lib/export/asb-archive"
import { importAsbDefinition } from "../lib/import/asb-archive"
import { htmlToPngBuffer } from "../lib/printUtils"
import {
  createAsbBranchQuestion,
  deleteAsbBranchQuestion,
  reorderAsbBranchQuestions,
  updateAsbBranchQuestion,
} from "../lib/prisma/asbBranchQuestion"
import {
  createAsbCharGuide,
  deleteAsbCharGuide,
  updateAsbCharGuide,
} from "../lib/prisma/asbCharGuide"
import {
  applyAsbLabelPreset,
  deleteAsbDefinition,
  getAsbDefinition,
  getAsbDefinitionOwner,
  listAsbDefinitions,
  transferAsbDefinitionOwner,
  updateAsbDefinition,
} from "../lib/prisma/asbDefinition"
import { replaceAsbDefinition } from "../lib/prisma/asbDefinitionReplace"
import {
  createAsbHeaderField,
  deleteAsbHeaderField,
  reorderAsbHeaderFields,
  updateAsbHeaderField,
} from "../lib/prisma/asbHeaderField"
import {
  createAsbImageElement,
  deleteAsbImageElement,
  updateAsbImageElement,
} from "../lib/prisma/asbImageElement"
import {
  createAsbMajorQuestion,
  deleteAsbMajorQuestion,
  reorderAsbMajorQuestions,
  updateAsbMajorQuestion,
} from "../lib/prisma/asbMajorQuestion"
import {
  setAsbManuscriptPaperEnabled,
  updateAsbManuscriptPaper,
} from "../lib/prisma/asbManuscriptPaper"
import {
  deleteAsbOmrConfig,
  upsertAsbOmrConfig,
} from "../lib/prisma/asbOmrConfig"
import {
  createAsbSubQuestion,
  deleteAsbSubQuestion,
  reorderAsbSubQuestions,
  updateAsbSubQuestion,
} from "../lib/prisma/asbSubQuestion"
import {
  createAsbTextElement,
  deleteAsbTextElement,
  updateAsbTextElement,
} from "../lib/prisma/asbTextElement"
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

  // 定義まるごとの置き換え。**日常の編集をここへ流さない**（下の1件ずつの書き込みへ）。
  // 通すのは新規作成・undo/redo・複製・アーカイブ取り込みの4経路だけで、どれも
  // 「全体を指定する」ことに意味がある（docs/asb-ipc-split-plan.md §4.5）
  "asb:replace-definition": async (
    definition: AnswerSheetDefinition,
    ownerUserId: string
  ) => {
    await replaceAsbDefinition(definition, ownerUserId)
  },

  // ---------------------------------------------------------------------------
  // 1件ずつの書き込み（実体 × 操作）
  //
  // どれも `definitionId` を先に取る。**担当かどうかの判定に要る**（判定は現在の DB を
  // 見て main が行う。renderer が渡す利用者 id は信じない）。また、子だけが変わった
  // ときも解答用紙の更新日時を進める必要があり、その相手を名指しするのにも要る。
  // ---------------------------------------------------------------------------

  "asb:update-definition": async (
    definitionId: string,
    attributes: AsbDefinitionAttributes
  ) => {
    await updateAsbDefinition(definitionId, attributes)
  },

  "asb:apply-label-preset": async (
    definitionId: string,
    category: LabelCategory,
    preset: string,
    relabeled: LabelAssignment[]
  ) => {
    await applyAsbLabelPreset(definitionId, category, preset, relabeled)
  },

  "asb:create-header-field": async (
    definitionId: string,
    headerField: HeaderFieldDefinition
  ) => {
    await createAsbHeaderField(definitionId, headerField)
  },

  "asb:update-header-field": async (
    definitionId: string,
    headerFieldId: string,
    attributes: AsbHeaderFieldAttributes
  ) => {
    await updateAsbHeaderField(definitionId, headerFieldId, attributes)
  },

  "asb:delete-header-field": async (
    definitionId: string,
    headerFieldId: string
  ) => {
    await deleteAsbHeaderField(definitionId, headerFieldId)
  },

  "asb:reorder-header-fields": async (
    definitionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbHeaderFields(definitionId, orderedIds)
  },

  "asb:create-major-question": async (
    definitionId: string,
    majorQuestion: MajorQuestion
  ) => {
    await createAsbMajorQuestion(definitionId, majorQuestion)
  },

  "asb:update-major-question": async (
    definitionId: string,
    majorQuestionId: string,
    attributes: AsbMajorQuestionAttributes
  ) => {
    await updateAsbMajorQuestion(definitionId, majorQuestionId, attributes)
  },

  "asb:delete-major-question": async (
    definitionId: string,
    majorQuestionId: string
  ) => {
    await deleteAsbMajorQuestion(definitionId, majorQuestionId)
  },

  "asb:reorder-major-questions": async (
    definitionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbMajorQuestions(definitionId, orderedIds)
  },

  "asb:create-sub-question": async (
    definitionId: string,
    majorQuestionId: string,
    subQuestion: SubQuestion
  ) => {
    await createAsbSubQuestion(definitionId, majorQuestionId, subQuestion)
  },

  "asb:update-sub-question": async (
    definitionId: string,
    subQuestionId: string,
    attributes: AsbSubQuestionAttributes
  ) => {
    await updateAsbSubQuestion(definitionId, subQuestionId, attributes)
  },

  "asb:delete-sub-question": async (
    definitionId: string,
    subQuestionId: string
  ) => {
    await deleteAsbSubQuestion(definitionId, subQuestionId)
  },

  "asb:reorder-sub-questions": async (
    definitionId: string,
    majorQuestionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbSubQuestions(definitionId, majorQuestionId, orderedIds)
  },

  "asb:create-branch-question": async (
    definitionId: string,
    subQuestionId: string,
    branchQuestion: BranchQuestion
  ) => {
    await createAsbBranchQuestion(definitionId, subQuestionId, branchQuestion)
  },

  "asb:update-branch-question": async (
    definitionId: string,
    branchQuestionId: string,
    attributes: AsbBranchQuestionAttributes
  ) => {
    await updateAsbBranchQuestion(definitionId, branchQuestionId, attributes)
  },

  "asb:delete-branch-question": async (
    definitionId: string,
    branchQuestionId: string
  ) => {
    await deleteAsbBranchQuestion(definitionId, branchQuestionId)
  },

  "asb:reorder-branch-questions": async (
    definitionId: string,
    subQuestionId: string,
    orderedIds: string[]
  ) => {
    await reorderAsbBranchQuestions(definitionId, subQuestionId, orderedIds)
  },

  "asb:create-text-element": async (
    definitionId: string,
    parent: AsbCellParent,
    textElement: CellTextElement
  ) => {
    await createAsbTextElement(definitionId, parent, textElement)
  },

  "asb:update-text-element": async (
    definitionId: string,
    textElementId: string,
    attributes: AsbTextElementAttributes
  ) => {
    await updateAsbTextElement(definitionId, textElementId, attributes)
  },

  "asb:delete-text-element": async (
    definitionId: string,
    textElementId: string
  ) => {
    await deleteAsbTextElement(definitionId, textElementId)
  },

  "asb:create-image-element": async (
    definitionId: string,
    parent: AsbCellParent,
    imageElement: CellImageElement
  ) => {
    await createAsbImageElement(definitionId, parent, imageElement)
  },

  "asb:update-image-element": async (
    definitionId: string,
    imageElementId: string,
    attributes: AsbImageElementAttributes
  ) => {
    await updateAsbImageElement(definitionId, imageElementId, attributes)
  },

  "asb:delete-image-element": async (
    definitionId: string,
    imageElementId: string
  ) => {
    await deleteAsbImageElement(definitionId, imageElementId)
  },

  // 原稿用紙の行を作る経路はここだけ。返すのは**実際に書いた行の id**で、既にそのセルに
  // 行があれば渡された id は捨てられるので、捨てた結果を renderer が木へ取り込める
  "asb:set-manuscript-paper-enabled": async (
    definitionId: string,
    parent: AsbCellParent,
    manuscriptPaperId: string,
    enabled: boolean,
    initialSettings: AsbManuscriptPaperSettings
  ): Promise<string> =>
    await setAsbManuscriptPaperEnabled(
      definitionId,
      parent,
      manuscriptPaperId,
      enabled,
      initialSettings
    ),

  "asb:update-manuscript-paper": async (
    definitionId: string,
    manuscriptPaperId: string,
    settings: AsbManuscriptPaperSettings
  ) => {
    await updateAsbManuscriptPaper(definitionId, manuscriptPaperId, settings)
  },

  "asb:create-char-guide": async (
    definitionId: string,
    manuscriptPaperId: string,
    charGuide: ManuscriptCharGuide
  ) => {
    await createAsbCharGuide(definitionId, manuscriptPaperId, charGuide)
  },

  "asb:update-char-guide": async (
    definitionId: string,
    charGuideId: string,
    attributes: AsbCharGuideAttributes
  ) => {
    await updateAsbCharGuide(definitionId, charGuideId, attributes)
  },

  "asb:delete-char-guide": async (
    definitionId: string,
    charGuideId: string
  ) => {
    await deleteAsbCharGuide(definitionId, charGuideId)
  },

  "asb:upsert-omr-config": async (
    definitionId: string,
    parent: AsbCellParent,
    config: OMRCellConfig
  ) => {
    await upsertAsbOmrConfig(definitionId, parent, config)
  },

  "asb:delete-omr-config": async (
    definitionId: string,
    parent: AsbCellParent
  ) => {
    await deleteAsbOmrConfig(definitionId, parent)
  },

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
    const relativePath = getRelativePathFromData(destPath)
    return relativePath
  },

  // 画像削除
  "asb:delete-image": async (args: ASBDeleteImageArgs) => {
    const absolutePath = getAbsolutePathFromData(args.imagePath)
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

  // 定義のインポートファイル選択
  "asb:select-import-file": async () => {
    const result = await dialog.showOpenDialog({
      title: "解答用紙を読み込み",
      filters: [{ name: "解答用紙", extensions: ["asb"] }],
      properties: ["openFile"],
    })

    // 選ばずに閉じたのは失敗ではない
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }
    return { canceled: false as const, filePath: result.filePaths[0] }
  },

  // 定義エクスポート
  "asb:export-definition": async (definitionId: string) => {
    return await exportAsbDefinition(definitionId)
  },

  // 定義インポート
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

    // 原稿用紙と文字位置マーカーは別テーブルの行なので、ここで id を振り直さないと
    // 元の id を引き継いだまま作成しようとして主キーが衝突する。画像ディレクトリの
    // 作成とコピーは先に走るため、トランザクションが巻き戻っても孤児のファイルが
    // 残る（docs/branch-review-findings.md #8）
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
