/**
 * 成績算出Excel出力用のデータ取得
 */

import type { GradeCalculationResult } from "../../../../src/types/grade.types"
import prisma from "../../prisma/client"
import { calculateGrades } from "../../shared/calculations/gradeCalculator"

export interface GradeExportData {
  result: GradeCalculationResult
  examName: string
  classNames: string[]
}

/** 成績算出の計算結果と関連情報を取得し、Excel出力用データとして返す */
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

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: {
        name: true,
        gradeClassrooms: {
          include: { classroom: { select: { name: true } } },
          orderBy: { order: "asc" },
        },
      },
    })

    return {
      success: true,
      data: {
        result: calcResult.result,
        examName: grade?.name ?? "",
        classNames:
          grade?.gradeClassrooms.map(
            (gradeClass) => gradeClass.classroom.name
          ) ?? [],
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
