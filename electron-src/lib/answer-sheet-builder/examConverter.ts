/**
 * 解答用紙定義 → 採点試験変換
 *
 * renderer側から受け取った multiPageLayout + HTML文字列 → BrowserWindow + capturePage でPNG化
 * → Exam + ExamPage + MasterImage + CropRegion 作成
 */

import fs from "fs"
import path from "path"

import type { AnswerSheetDefinition } from "../../../types/answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "../../../types/answerSheetLayout.types"
import type { OMRCellConfig, OMRTemplate } from "../../../types/omr.types"
import {
  getDataDirectory,
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import { htmlToPngBuffer } from "../printUtils"
import prisma from "../prisma/client"
import { createExam } from "../prisma/exam"
import { createExamPage } from "../prisma/examPage"

export interface ConvertToExamResult {
  success: boolean
  examId?: string
  error?: string
}

/**
 * 解答用紙定義を採点試験に変換
 * renderer側からmultiPageLayout + HTML文字列を受け取り、PNGバッファ生成→DB作成
 */
export async function convertToExam(
  definition: AnswerSheetDefinition,
  userId: string,
  multiPageLayout: ComputedMultiPageLayout,
  answerSheetHtmlPages: string[],
  modelAnswerHtmlPages: string[]
): Promise<ConvertToExamResult> {
  try {
    // 0. OMR設定を問題定義から抽出
    const omrCellConfigs: Record<string, OMRCellConfig> = {}
    definition.majorQuestions.forEach((major, mi) => {
      major.subQuestions.forEach((sub, si) => {
        if (sub.omrConfig) {
          omrCellConfigs[`${mi}-${si}`] = sub.omrConfig
        }
        sub.branchQuestions.forEach((branch, bi) => {
          if (branch.omrConfig) {
            omrCellConfigs[`${mi}-${si}-${bi}`] = branch.omrConfig
          }
        })
      })
    })

    // 1. 試験作成
    const exam = await createExam(
      {
        examName: definition.name,
        description: `解答用紙ビルダーから生成（${definition.settings.paperSize} ${definition.settings.orientation}、${multiPageLayout.totalPages}ページ）`,
      },
      userId
    )

    // 2. HTML → PNG Buffer 生成（BrowserWindow + capturePage）
    const dpi = 300
    const { pageWidthMm, pageHeightMm } = multiPageLayout

    const templateBuffers: Buffer[] = []
    for (const html of answerSheetHtmlPages) {
      const buf = await htmlToPngBuffer(html, pageWidthMm, pageHeightMm, dpi)
      templateBuffers.push(buf)
    }

    const modelBuffers: Buffer[] = []
    for (const html of modelAnswerHtmlPages) {
      const buf = await htmlToPngBuffer(html, pageWidthMm, pageHeightMm, dpi)
      modelBuffers.push(buf)
    }

    // 3. 画像ファイル保存 + DB作成（ページごと）
    const masterDir = getMasterAnswersDirectory(exam.id)
    if (!fs.existsSync(masterDir)) {
      fs.mkdirSync(masterDir, { recursive: true })
    }

    let globalOrderIndex = 0

    for (let pi = 0; pi < multiPageLayout.totalPages; pi++) {
      const pageLayout = multiPageLayout.pages[pi]
      const timestamp = Date.now() + pi

      // 模範解答PNG保存
      const masterImageFileName = `master-${timestamp}.png`
      const masterImagePath = path.join(masterDir, masterImageFileName)
      fs.writeFileSync(masterImagePath, modelBuffers[pi])
      const relativeMasterPath = getRelativePathFromData(masterImagePath)

      // 答案テンプレートPNG保存
      const templateFileName = `template-${timestamp}.png`
      const templatePath = path.join(masterDir, templateFileName)
      fs.writeFileSync(templatePath, templateBuffers[pi])

      // ExamPage作成
      const examPage = await createExamPage({
        examId: exam.id,
        pageNumber: pi + 1,
      })

      // MasterImage作成
      await prisma.masterImage.create({
        data: {
          examPageId: examPage.id,
          imagePath: relativeMasterPath,
        },
      })

      // CropRegion作成（このページの解答セルのみ）
      const answerCells = pageLayout.cells.filter(
        (c) => c.cellType === "answer"
      )
      for (let i = 0; i < answerCells.length; i++) {
        const cell = answerCells[i]
        await prisma.cropRegion.create({
          data: {
            examPageId: examPage.id,
            label: cell.label,
            type: "QUESTION_ANSWER",
            x: cell.normalizedX,
            y: cell.normalizedY,
            width: cell.normalizedW,
            height: cell.normalizedH,
            points: cell.points,
            orderIndex: globalOrderIndex++,
          },
        })
      }

      // CropRegion作成（ヘッダーフィールドのlinkedRegionType）
      const linkedFields = pageLayout.headerFields.filter(
        (hf) => hf.linkedRegionType
      )
      for (const hf of linkedFields) {
        const normalizedX = hf.x / multiPageLayout.pageWidthMm
        const normalizedY = hf.y / multiPageLayout.pageHeightMm
        const normalizedW = hf.width / multiPageLayout.pageWidthMm
        const normalizedH = hf.height / multiPageLayout.pageHeightMm
        await prisma.cropRegion.create({
          data: {
            examPageId: examPage.id,
            label: hf.label,
            type: hf.linkedRegionType!,
            x: normalizedX,
            y: normalizedY,
            width: normalizedW,
            height: normalizedH,
            points: null,
            orderIndex: globalOrderIndex++,
          },
        })
      }
    }

    // 4. OMRテンプレート保存（OMR設定がある場合）
    if (Object.keys(omrCellConfigs).length > 0) {
      const omrTemplate: OMRTemplate = {
        definitionId: definition.id,
        cellConfigs: omrCellConfigs,
        recognitionParams: {
          colorThreshold: 25,
          areaThreshold: 0.4,
        },
      }
      const dataDir = getDataDirectory()
      const examDir = path.join(dataDir, "exams", exam.id)
      if (!fs.existsSync(examDir)) {
        fs.mkdirSync(examDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(examDir, "omr-template.json"),
        JSON.stringify(omrTemplate, null, 2)
      )
    }

    return { success: true, examId: exam.id }
  } catch (error) {
    console.error("Failed to convert answer sheet to exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "試験変換に失敗しました",
    }
  }
}
