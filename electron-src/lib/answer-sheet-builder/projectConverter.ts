/**
 * 解答用紙定義 → 採点プロジェクト変換
 *
 * AnswerSheetDefinition → PNG生成 → Project + ProjectPage + MasterImage + CropRegion 作成
 */

import fs from "fs"
import path from "path"

import type { AnswerSheetDefinition } from "../../../types/answerSheetBuilder.types"
import {
  getMasterAnswersDirectory,
  getRelativePathFromData,
} from "../dataManager"
import prisma from "../prisma/client"
import { createProject } from "../prisma/project"
import { createProjectPage } from "../prisma/projectPage"
import { computeLayout } from "./layoutEngine"
import { generatePngBuffer } from "./pngGenerator"

export interface ConvertToProjectResult {
  success: boolean
  projectId?: string
  error?: string
}

/**
 * 解答用紙定義を採点プロジェクトに変換
 */
export async function convertToProject(
  definition: AnswerSheetDefinition,
  userId: string,
  svgString?: string
): Promise<ConvertToProjectResult> {
  try {
    // 1. レイアウト計算
    const layout = computeLayout(definition)

    // 2. プロジェクト作成
    const project = await createProject(
      {
        examName: definition.name,
        description: `解答用紙ビルダーから生成（${definition.settings.paperSize} ${definition.settings.orientation}）`,
      },
      userId
    )

    // 3. PNG生成（模範解答なしの空白解答用紙）
    const answerSheetDef: AnswerSheetDefinition = {
      ...definition,
      renderMode: "answer-sheet",
    }
    const pngBuffer = await generatePngBuffer(answerSheetDef, 300, svgString)

    // 4. 模範解答PNG生成
    const modelAnswerDef: AnswerSheetDefinition = {
      ...definition,
      renderMode: "model-answer",
    }
    const modelPngBuffer = await generatePngBuffer(modelAnswerDef, 300)

    // 5. 画像ファイル保存
    const masterDir = getMasterAnswersDirectory(project.id)
    if (!fs.existsSync(masterDir)) {
      fs.mkdirSync(masterDir, { recursive: true })
    }

    const masterImageFileName = `master-${Date.now()}.png`
    const masterImagePath = path.join(masterDir, masterImageFileName)
    fs.writeFileSync(masterImagePath, modelPngBuffer)
    const relativeMasterPath = getRelativePathFromData(masterImagePath)

    // 答案テンプレート画像も保存（空白解答用紙）
    const templateFileName = `template-${Date.now()}.png`
    const templatePath = path.join(masterDir, templateFileName)
    fs.writeFileSync(templatePath, pngBuffer)

    // 6. ProjectPage作成
    const projectPage = await createProjectPage({
      projectId: project.id,
      pageNumber: 1,
    })

    // 7. MasterImage作成
    await prisma.masterImage.create({
      data: {
        projectPageId: projectPage.id,
        imagePath: relativeMasterPath,
      },
    })

    // 8. CropRegion作成（解答セルのみ）
    const answerCells = layout.cells.filter((c) => c.cellType === "answer")
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
          orderIndex: i,
        },
      })
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
