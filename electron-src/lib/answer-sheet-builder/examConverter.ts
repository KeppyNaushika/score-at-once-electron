/**
 * 解答用紙定義 → 採点試験変換
 *
 * renderer側から受け取った multiPageLayout + HTML文字列 → BrowserWindow + capturePage でPNG化
 * → Exam + ExamPage + MasterImage + CropRegion 作成
 */

import fs from "fs"
import path from "path"

import type { AnswerSheetDefinition } from "../../../src/types/answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "../../../src/types/answerSheetLayout.types"
import type { OMRCellConfig } from "../../../src/types/omr.types"
import {
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import { htmlToPngBuffer } from "../printUtils"
import prisma from "../prisma/client"
import { upsertOmrConfig } from "../prisma/cropRegionOmrConfig"
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
          pageSize: definition.settings.paperSize ?? "A4",
        },
      })

      // CropRegion作成（このページの解答セルのみ）
      // 枝問配点オフの場合、同一小問の枝問セルを1つの領域に統合する
      const answerCells = pageLayout.cells.filter(
        (c) => c.cellType === "answer"
      )

      // 枝問配点オフの小問を特定し、枝問セルをグループ化
      const mergedCells: Array<{
        label: string
        normalizedX: number
        normalizedY: number
        normalizedW: number
        normalizedH: number
        points: number
        omrConfigKey?: string // omrCellConfigsのキー
      }> = []
      const processedKeys = new Set<string>()

      for (const cell of answerCells) {
        const [mi, si, bi] = cell.questionPath
        const isBranch = bi !== undefined

        if (isBranch) {
          const key = `${mi}-${si}`
          if (processedKeys.has(key)) continue

          const sub = definition.majorQuestions[mi]?.subQuestions[si]
          if (sub?.usesBranchPoints === false) {
            // 同一小問の全枝問セル（同一ページ内）を統合
            processedKeys.add(key)
            const siblings = answerCells.filter(
              (c) =>
                c.questionPath[0] === mi &&
                c.questionPath[1] === si &&
                c.questionPath.length === 3
            )
            const minX = Math.min(...siblings.map((c) => c.normalizedX))
            const minY = Math.min(...siblings.map((c) => c.normalizedY))
            const maxX = Math.max(
              ...siblings.map((c) => c.normalizedX + c.normalizedW)
            )
            const maxY = Math.max(
              ...siblings.map((c) => c.normalizedY + c.normalizedH)
            )
            mergedCells.push({
              label: sub.label,
              normalizedX: minX,
              normalizedY: minY,
              normalizedW: maxX - minX,
              normalizedH: maxY - minY,
              points: sub.points,
              omrConfigKey: omrCellConfigs[key] ? key : undefined,
            })
            continue
          }
        }

        // 通常セル（枝問配点オン or 枝問なし）
        const cellKey = cell.questionPath.join("-")
        mergedCells.push({
          label: cell.label,
          normalizedX: cell.normalizedX,
          normalizedY: cell.normalizedY,
          normalizedW: cell.normalizedW,
          normalizedH: cell.normalizedH,
          points: cell.points,
          omrConfigKey: omrCellConfigs[cellKey] ? cellKey : undefined,
        })
      }

      for (const cell of mergedCells) {
        const cropRegion = await prisma.cropRegion.create({
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

        // OMR設定をDBに保存
        if (cell.omrConfigKey) {
          const omrCfg = omrCellConfigs[cell.omrConfigKey]
          if (omrCfg) {
            await upsertOmrConfig(
              omrCfg.type === "choice"
                ? {
                    cropRegionId: cropRegion.id,
                    type: "choice",
                    numChoices: omrCfg.numChoices,
                    choiceLayout: omrCfg.layout,
                    choiceOptions: omrCfg.labels.map((label, idx) => ({
                      choiceIndex: idx,
                      label,
                      isCorrect: omrCfg.correctAnswers.includes(idx),
                    })),
                  }
                : {
                    cropRegionId: cropRegion.id,
                    type: "handwritten-digit",
                    numDigits: omrCfg.numDigits,
                    correctAnswer: omrCfg.correctAnswer ?? null,
                  }
            )
          }
        }
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

    // OMR設定はCropRegionOmrConfigテーブルに保存済み（omr-template.json不要）

    return { success: true, examId: exam.id }
  } catch (error) {
    console.error("Failed to convert answer sheet to exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "試験変換に失敗しました",
    }
  }
}
