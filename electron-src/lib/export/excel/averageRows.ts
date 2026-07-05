import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"

import type { ExamClassroomWithMembers } from "@/types/prismaExtensions"

import { average as mean } from "../../shared/calculations/numericStats"
import type { ScoringData } from "../../shared/types/exportTypes"
import { applyCellStyle } from "../../shared/utilities/excelUtilities"
import type { SubtotalColumn } from "./dataFetcher"

/** null を除いた平均（小数1桁）。対象が無ければ null（セル空欄用） */
function average(values: (number | null | undefined)[]): number | null {
  const numbers = values.filter((value): value is number => value != null)
  if (numbers.length === 0) return null
  return Math.round(mean(numbers) * 10) / 10
}

/** 指定生徒集合の 合計点／小計／設問 の平均行（ヘッダー列順）を作る */
function buildAverageRow(
  label: string,
  students: ScoringData[],
  subtotalColumns: SubtotalColumn[],
  questionRegions: CropRegion[]
): (string | number)[] {
  const totalAvg = average(students.map((student) => student.totalScore))
  const subtotalAvgs = subtotalColumns.map((subtotalColumn) =>
    average(
      students.map(
        (student) =>
          student.subtotalScores.find(
            (subtotalScore) =>
              subtotalScore.subtotalId === subtotalColumn.subtotalId
          )?.score
      )
    )
  )
  const questionAvgs = questionRegions.map((region) =>
    average(
      students.map((student) => {
        const matchedScore = student.scores.find(
          (score) => score.questionId === region.id
        )
        // 未採点は集計から除外（null）
        return matchedScore && matchedScore.status !== "unscored"
          ? matchedScore.score
          : null
      })
    )
  )

  // 列順: 受験状態,順位,学年,学級,出席番号,学籍番号,氏名,合計点,...小計,...設問
  return [
    "",
    "",
    "",
    "",
    "",
    "",
    label,
    totalAvg ?? "",
    ...subtotalAvgs.map((subtotalAvg) => subtotalAvg ?? ""),
    ...questionAvgs.map((questionAvg) => questionAvg ?? ""),
  ]
}

/**
 * 学級平均行を点数一覧シートへ追加する（Phase 4・主成果）
 *
 * - 1行目: 全体平均（受験者＝合計点 non-null）
 * - 以降: teacherStatistics=true の登録学級ごとの学級平均
 *   母集団は「学級全体」（受験日所属者・getClassroomMembersForExam）。生徒選択チェックとは無関係。
 *   1人の生徒は所属する全学級の平均に重複カウントされる。
 *
 * @param allScoringData 全受験生徒の採点データ（選択生徒ではなく試験全体）
 * @param teacherStatisticsClassrooms teacherStatistics=true の登録学級（受験日所属生徒つき）
 */
export function appendClassroomAverageRows(
  worksheet: ExcelJS.Worksheet,
  allScoringData: ScoringData[],
  teacherStatisticsClassrooms: ExamClassroomWithMembers[],
  subtotalColumns: SubtotalColumn[],
  questionRegions: CropRegion[]
): void {
  if (allScoringData.length === 0) return

  // 区切りの空行
  worksheet.addRow([])

  // 全体平均
  const overallRow = worksheet.addRow(
    buildAverageRow(
      "全体平均",
      allScoringData,
      subtotalColumns,
      questionRegions
    )
  )
  overallRow.eachCell((cell) => applyCellStyle(cell, "total"))

  // 学級ごとの平均（teacherStatistics=true）
  const byId = new Map(
    allScoringData.map((scoringData) => [scoringData.studentId, scoringData])
  )
  for (const examClassroom of teacherStatisticsClassrooms) {
    const members = examClassroom.classroom.memberships
      .map((membership) => byId.get(membership.studentId))
      .filter(
        (scoringData): scoringData is ScoringData => scoringData !== undefined
      )
    if (members.length === 0) continue

    const row = worksheet.addRow(
      buildAverageRow(
        `${examClassroom.classroom.name}平均`,
        members,
        subtotalColumns,
        questionRegions
      )
    )
    row.eachCell((cell) => applyCellStyle(cell, "subtotal"))
  }
}
