/**
 * 解答用紙定義 → 採点プロジェクト変換
 *
 * AnswerSheetDefinition → PNG生成 → Project + ProjectPage + MasterImage + CropRegion 作成
 */

import fs from "fs"
import path from "path"

import type { AnswerSheetDefinition } from "../../../types/answerSheetBuilder.types"
import type { OMRCellConfig, OMRTemplate } from "../../../types/omr.types"
import {
  getDataDirectory,
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import prisma from "../prisma/client"
import { createProject } from "../prisma/project"
import { createProjectPage } from "../prisma/projectPage"
import { computeMultiPageLayout } from "./layoutEngine"
import { generatePngBuffer } from "./pngGenerator"

export interface ConvertToProjectResult {
  success: boolean
  projectId?: string
  error?: string
}

/**
 * 解答用紙定義を採点プロジェクトに変換
 * 複数ページ対応: ページごとにProjectPage + MasterImage + CropRegionを作成
 */
export async function convertToProject(
  definition: AnswerSheetDefinition,
  userId: string,
  svgString?: string
): Promise<ConvertToProjectResult> {
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

    // 1. レイアウト計算（複数ページ）
    const multiLayout = computeMultiPageLayout(definition)

    // 2. プロジェクト作成
    const project = await createProject(
      {
        examName: definition.name,
        description: `解答用紙ビルダーから生成（${definition.settings.paperSize} ${definition.settings.orientation}、${multiLayout.totalPages}ページ）`,
      },
      userId
    )

    // 3. PNG生成（空白解答用紙 + 模範解答、ページごと）
    const answerSheetDef: AnswerSheetDefinition = {
      ...definition,
      renderMode: "answer-sheet",
    }
    const templateBuffers = await generatePngBuffer(
      answerSheetDef,
      300,
      svgString
    )

    const modelAnswerDef: AnswerSheetDefinition = {
      ...definition,
      renderMode: "model-answer",
    }
    const modelBuffers = await generatePngBuffer(modelAnswerDef, 300)

    // 4. 画像ファイル保存 + DB作成（ページごと）
    const masterDir = getMasterAnswersDirectory(project.id)
    if (!fs.existsSync(masterDir)) {
      fs.mkdirSync(masterDir, { recursive: true })
    }

    let globalOrderIndex = 0

    for (let pi = 0; pi < multiLayout.totalPages; pi++) {
      const pageLayout = multiLayout.pages[pi]
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

      // ProjectPage作成
      const projectPage = await createProjectPage({
        projectId: project.id,
        pageNumber: pi + 1,
      })

      // MasterImage作成
      await prisma.masterImage.create({
        data: {
          projectPageId: projectPage.id,
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
            projectPageId: projectPage.id,
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
    }

    // 5. OMRテンプレート保存（OMR設定がある場合）
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
      const projectDir = path.join(dataDir, "projects", project.id)
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(projectDir, "omr-template.json"),
        JSON.stringify(omrTemplate, null, 2)
      )
    }

    return { success: true, projectId: project.id }
  } catch (error) {
    console.error("Failed to convert answer sheet to project:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "プロジェクト変換に失敗しました",
    }
  }
}
