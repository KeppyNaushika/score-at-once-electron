/**
 * R / exametrika 向けデータエクスポート（#834）
 *
 * 設問×生徒の得点行列を CSV / JSON で出力する。
 * 正誤の二値（1/0）に加え、欠席・未採点・無回答を区別できるよう
 * 元の status を保持する（JSON）。CSV は欠席/未採点を欠測値（空欄）とする。
 */
import { dialog } from "electron"
import * as fs from "fs/promises"

import type { ExportResult } from "../../shared/types/exportTypes"
import { fetchExportData } from "../excel/dataFetcher"

export interface ExportRDataOptions {
  examId: string
  selectedStudentIds: string[]
  format: "csv" | "json"
  outputPath?: string
}

/** ファイル名として安全でない文字を置換する */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim()
}

/**
 * 設問の正誤を二値（1=正答, 0=誤答）へ。
 * 未採点・欠席は欠測（null）として扱う。無回答は誤答(0)。
 */
function toBinary(status: string, studentAbsent: boolean): number | null {
  if (studentAbsent) return null
  if (status === "unscored") return null
  if (status === "correct") return 1
  return 0
}

/** CSVセルのエスケープ（カンマ・引用符・改行を含む場合は引用） */
function csvCell(value: string | number): string {
  const s = String(value)
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * R / exametrika 向けデータをエクスポート
 */
export async function exportRData(
  options: ExportRDataOptions
): Promise<ExportResult> {
  try {
    const { examId, selectedStudentIds, format } = options

    const dataResult = await fetchExportData(examId, selectedStudentIds)
    if (!dataResult.success || !dataResult.scoringData) {
      return {
        success: false,
        error: dataResult.error || "データ取得に失敗しました",
      }
    }

    const scoringData = dataResult.scoringData
    if (scoringData.length === 0) {
      return { success: false, error: "出力対象の生徒がいません" }
    }

    // 設問列は最初の生徒の並びを基準にする
    const questions = scoringData[0].scores.map((s) => ({
      questionId: s.questionId,
      label: s.questionLabel,
      maxScore: s.maxScore,
    }))

    let content: string
    if (format === "json") {
      content = JSON.stringify(
        {
          exam: { examName: dataResult.exam?.examName ?? "" },
          questions,
          students: scoringData.map((sd) => {
            const absent = sd.status === "absent"
            return {
              studentId: sd.studentId,
              studentName: sd.studentName,
              studentNumber: sd.studentNumber,
              status: sd.status ?? "participating",
              totalScore: sd.totalScore,
              totalMaxScore: sd.totalMaxScore,
              responses: sd.scores.map((s) => ({
                questionId: s.questionId,
                status: s.status,
                score: s.score,
                binary: toBinary(s.status, absent),
              })),
            }
          }),
        },
        null,
        2
      )
    } else {
      // CSV: 出席番号・氏名 + 各設問の二値（欠測は空欄）
      const header = [
        "studentNumber",
        "studentName",
        ...questions.map((q) => q.label),
      ]
      const lines = [header.map(csvCell).join(",")]
      for (const sd of scoringData) {
        const absent = sd.status === "absent"
        const cells = [
          csvCell(sd.studentNumber),
          csvCell(sd.studentName),
          ...sd.scores.map((s) => {
            const b = toBinary(s.status, absent)
            return b === null ? "" : String(b)
          }),
        ]
        lines.push(cells.join(","))
      }
      // BOM付きUTF-8（Excel/R双方で文字化けを避ける）
      content = "﻿" + lines.join("\r\n")
    }

    // 保存先の決定
    let finalOutputPath = options.outputPath
    if (!finalOutputPath) {
      const dateStr = new Date().toISOString().slice(0, 10)
      const safeExamName = dataResult.exam?.examName
        ? sanitizeFileName(dataResult.exam.examName)
        : null
      const ext = format === "json" ? "json" : "csv"
      const fileName = safeExamName
        ? `分析用データ_${safeExamName}_${dateStr}.${ext}`
        : `分析用データ_${dateStr}.${ext}`

      const result = await dialog.showSaveDialog({
        title: "R / exametrika 向けデータの出力先を選択",
        defaultPath: fileName,
        filters: [
          format === "json"
            ? { name: "JSONファイル", extensions: ["json"] }
            : { name: "CSVファイル", extensions: ["csv"] },
        ],
      })
      if (result.canceled) {
        return { success: false, error: "出力がキャンセルされました" }
      }
      finalOutputPath = result.filePath
    }

    if (!finalOutputPath) {
      return { success: false, error: "出力パスが指定されていません" }
    }

    await fs.writeFile(finalOutputPath, content, "utf-8")
    return { success: true, outputPath: finalOutputPath }
  } catch (error) {
    console.error("R data export error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "出力に失敗しました",
    }
  }
}
