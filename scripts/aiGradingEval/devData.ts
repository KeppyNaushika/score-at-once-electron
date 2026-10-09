/**
 * 評価に使う開発用データ（デモ試験の写し）を、読み取り専用で読む。
 *
 * Prisma を通さず `node:sqlite` で開く。写しは古い版のスキーマのことがあり、今の Prisma の
 * 型とは列が合わないため。読むのは採点枠・答案画像・採点・確定だけで、氏名は読まない。
 */

import * as path from "path"
import { DatabaseSync, type SQLOutputValue } from "node:sqlite"

/** 採点枠（設問）1つ */
export interface EvalQuestion {
  cropRegionId: string
  label: string
  points: number | null
  orderIndex: number
  rect: { x: number; y: number; width: number; height: number }
  /** 模範解答のページ画像（絶対パス）。無ければ null */
  masterImagePath: string | null
}

/** 採点者1人の採点 */
export interface EvalTeacherScore {
  userId: string
  status: string
  partialScore: number | null
}

/** 生徒×設問の1マス */
export interface EvalCell {
  cropRegionId: string
  examStudentId: string
  /** 答案のページ画像（絶対パス） */
  answerImagePath: string
  teacherScores: EvalTeacherScore[]
  decision: { status: string; score: number | null } | null
}

export interface EvalExamData {
  questions: EvalQuestion[]
  cells: EvalCell[]
}

type Row = Record<string, SQLOutputValue>

function readText(row: Row, key: string): string {
  const field = row[key]
  if (typeof field !== "string")
    throw new Error(`${key} が文字列ではありません`)
  return field
}

function readNullableNumber(row: Row, key: string): number | null {
  const field = row[key]
  if (field === null || field === undefined) return null
  if (typeof field === "number") return field
  if (typeof field === "bigint") return Number(field)
  if (typeof field === "string" && field.trim() !== "") return Number(field)
  throw new Error(`${key} が数ではありません`)
}

function readNumber(row: Row, key: string): number {
  const field = readNullableNumber(row, key)
  if (field === null) throw new Error(`${key} が空です`)
  return field
}

/** 試験の設問と、全マスの答案・採点を読む */
export function loadEvalExamData(
  dbPath: string,
  dataDir: string,
  examId: string
): EvalExamData {
  const database = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const questionRows = database
      .prepare(
        `SELECT c.id, c.label, c.points, c.orderIndex, c.x, c.y, c.width, c.height, p.imagePath
           FROM CropRegion c JOIN ExamPage p ON p.id = c.examPageId
          WHERE p.examId = ? AND c.type = 'QUESTION_ANSWER'
          ORDER BY p.pageNumber, c.orderIndex`
      )
      .all(examId)
    const questions = questionRows.map((row) => {
      const masterImage = row.imagePath
      return {
        cropRegionId: readText(row, "id"),
        label: readText(row, "label"),
        points: readNullableNumber(row, "points"),
        orderIndex: readNullableNumber(row, "orderIndex") ?? 0,
        rect: {
          x: readNumber(row, "x"),
          y: readNumber(row, "y"),
          width: readNumber(row, "width"),
          height: readNumber(row, "height"),
        },
        masterImagePath:
          typeof masterImage === "string"
            ? path.resolve(dataDir, masterImage)
            : null,
      }
    })

    const cellRows = database
      .prepare(
        `SELECT c.id AS cropRegionId, s.examStudentId, s.imagePath
           FROM CropRegion c
           JOIN ExamPage p ON p.id = c.examPageId
           JOIN StudentAnswerImage s ON s.examPageId = p.id
           JOIN ExamStudent es ON es.id = s.examStudentId
          WHERE p.examId = ? AND c.type = 'QUESTION_ANSWER'`
      )
      .all(examId)
    const scoreRows = database
      .prepare(
        `SELECT q.cropRegionId, q.examStudentId, q.userId, q.status, q.partialScore
           FROM QuestionScore q JOIN CropRegion c ON c.id = q.cropRegionId
           JOIN ExamPage p ON p.id = c.examPageId WHERE p.examId = ?`
      )
      .all(examId)
    const decisionRows = database
      .prepare(
        `SELECT d.cropRegionId, d.examStudentId, d.verdict, d.score
           FROM ScoreDecision d JOIN CropRegion c ON c.id = d.cropRegionId
           JOIN ExamPage p ON p.id = c.examPageId WHERE p.examId = ?`
      )
      .all(examId)

    const cellKey = (row: Row) =>
      `${readText(row, "examStudentId")} ${readText(row, "cropRegionId")}`
    const scoresByCell = new Map<string, EvalTeacherScore[]>()
    scoreRows.forEach((row) => {
      const key = cellKey(row)
      const teacherScores = scoresByCell.get(key) ?? []
      teacherScores.push({
        userId: readText(row, "userId"),
        status: readText(row, "status"),
        partialScore: readNullableNumber(row, "partialScore"),
      })
      scoresByCell.set(key, teacherScores)
    })
    const decisionByCell = new Map(
      decisionRows.map((row) => [
        cellKey(row),
        {
          status: readText(row, "verdict"),
          score: readNullableNumber(row, "score"),
        },
      ])
    )

    const cells = cellRows.map((row) => ({
      cropRegionId: readText(row, "cropRegionId"),
      examStudentId: readText(row, "examStudentId"),
      answerImagePath: path.resolve(dataDir, readText(row, "imagePath")),
      teacherScores: scoresByCell.get(cellKey(row)) ?? [],
      decision: decisionByCell.get(cellKey(row)) ?? null,
    }))
    return { questions, cells }
  } finally {
    database.close()
  }
}
