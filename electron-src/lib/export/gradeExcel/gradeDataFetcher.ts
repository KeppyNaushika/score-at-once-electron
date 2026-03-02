/**
 * 成績算出Excel出力用のデータ取得
 */

import type { GradeCalculationResult } from "../../../../types/grade.types"
import prisma from "../../prisma/client"
import { calculateGrades } from "../../shared/calculations/gradeCalculator"

export interface GradeExportData {
  result: GradeCalculationResult
  examName: string
  classNames: string[]
}

export async function fetchGradeExportData(
  gradeId: string
): Promise<{ success: boolean; data?: GradeExportData; error?: string }> {
  try {
    const calcResult = await calculateGrades(gradeId)
    if (!calcResult.success || !calcResult.result) {
      return {
        success: false,
        error: calcResult.error ?? "成績算出に失敗しました",
      }
    }

    const gp = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: {
        name: true,
        gradeClasses: {
          include: { class: { select: { name: true } } },
          orderBy: { order: "asc" },
        },
      },
    })

    return {
      success: true,
      data: {
        result: calcResult.result,
        examName: gp?.name ?? "",
        classNames: gp?.gradeClasses.map((c) => c.class.name) ?? [],
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
