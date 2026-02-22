/**
 * 成績算出Excel出力用のデータ取得
 */

import type { GradeCalculationResult } from "../../../../types/gradeProject.types"
import prisma from "../../prisma/client"
import { calculateGrades } from "../../shared/calculations/gradeCalculator"

export interface GradeExportData {
  result: GradeCalculationResult
  projectName: string
  classNames: string[]
}

export async function fetchGradeExportData(
  gradeProjectId: string
): Promise<{ success: boolean; data?: GradeExportData; error?: string }> {
  try {
    const calcResult = await calculateGrades(gradeProjectId)
    if (!calcResult.success || !calcResult.result) {
      return {
        success: false,
        error: calcResult.error ?? "成績算出に失敗しました",
      }
    }

    const gp = await prisma.gradeProject.findUnique({
      where: { id: gradeProjectId },
      select: {
        name: true,
        gradeProjectClasses: {
          include: { class: { select: { name: true } } },
          orderBy: { order: "asc" },
        },
      },
    })

    return {
      success: true,
      data: {
        result: calcResult.result,
        projectName: gp?.name ?? "",
        classNames: gp?.gradeProjectClasses.map((c) => c.class.name) ?? [],
      },
    }
  } catch (error) {
    console.error("Error fetching grade export data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
