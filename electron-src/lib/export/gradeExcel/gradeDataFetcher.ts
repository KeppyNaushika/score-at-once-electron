/**
 * 成績算出Excel出力用のデータ取得
 */

import type { GradeCalculationResult } from "../../../../src/types/grade.types"
import prisma from "../../prisma/client"
import { calculateGrades } from "../../shared/calculations/gradeCalculator"

interface GradeExportData {
  result: GradeCalculationResult
  examName: string
  classNames: string[]
}

/** 成績算出の計算結果と関連情報を取得し、Excel出力用データとして返す */
export async function fetchGradeExportData(
  gradeId: string
): Promise<GradeExportData> {
  const result = await calculateGrades(gradeId)

  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: {
      gradeClassrooms: {
        include: { classroom: true },
        orderBy: { order: "asc" },
      },
    },
  })

  return {
    result,
    examName: grade?.name ?? "",
    classNames:
      grade?.gradeClassrooms.map(
        (gradeClassroom) => gradeClassroom.classroom.name
      ) ?? [],
  }
}
