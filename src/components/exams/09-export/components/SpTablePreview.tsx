"use client"

import type { SpTableResult } from "@/lib/shared/spAnalysis"

interface SpTablePreviewProps {
  data: SpTableResult
}

/**
 * S-P表プレビュー（#838）
 * 生徒（正答数降順）×設問（正答者数降順）の正誤表。
 * S曲線（行の正答数境界）を右の太罫線、P曲線（列の正答者数境界）を下の太罫線で表現。
 */
export function SpTablePreview({ data }: SpTablePreviewProps) {
  const { students, problems } = data

  const fmtCaution = (v: number | null): string =>
    v !== null ? v.toFixed(3) : "---"

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] text-muted-foreground">
        生徒{students.length}名 × 設問{problems.length}問。太線は S曲線（行）/
        P曲線（列）。注意係数が高いほど応答パターンが非定型。
      </p>
      <table className="border-collapse text-[10px]">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="border px-1 py-0.5 text-left">生徒</th>
            {problems.map((problem) => (
              <th
                key={problem.questionId}
                className="border px-1 py-0.5 text-center"
                title={`正答者数 ${problem.correctCount}`}
              >
                {problem.label}
              </th>
            ))}
            <th className="border px-1 py-0.5 text-right">正答数</th>
            <th className="border px-1 py-0.5 text-right">注意係数</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, rowIdx) => (
            <tr key={student.examStudentId} className="hover:bg-muted/50">
              <td className="border px-1 py-0.5 whitespace-nowrap">
                {student.studentName}
              </td>
              {student.cells.map((correct, colIdx) => {
                // S曲線: 正答数 c の右に縦境界
                const sCurve = colIdx === student.correctCount - 1
                // P曲線: 設問の正答者数 m の行の下に横境界
                const pCurve = rowIdx === problems[colIdx].correctCount - 1
                const borderClass = [
                  sCurve ? "border-r-2 border-r-gray-700" : "",
                  pCurve ? "border-b-2 border-b-gray-700" : "",
                ].join(" ")
                return (
                  <td
                    key={colIdx}
                    className={`border px-1 py-0.5 text-center ${
                      correct ? "bg-green-50 text-green-700" : "text-gray-300"
                    } ${borderClass}`}
                  >
                    {correct ? "○" : "・"}
                  </td>
                )
              })}
              <td className="border px-1 py-0.5 text-right font-medium">
                {student.correctCount}
              </td>
              <td className="border px-1 py-0.5 text-right">
                {fmtCaution(student.cautionIndex)}
              </td>
            </tr>
          ))}
          <tr className="bg-muted/70 font-medium">
            <td className="border px-1 py-0.5">正答者数</td>
            {problems.map((problem) => (
              <td
                key={problem.questionId}
                className="border px-1 py-0.5 text-center"
              >
                {problem.correctCount}
              </td>
            ))}
            <td className="border px-1 py-0.5"></td>
            <td className="border px-1 py-0.5"></td>
          </tr>
          <tr className="bg-muted/70 font-medium">
            <td className="border px-1 py-0.5">注意係数</td>
            {problems.map((problem) => (
              <td
                key={problem.questionId}
                className="border px-1 py-0.5 text-center"
              >
                {fmtCaution(problem.cautionIndex)}
              </td>
            ))}
            <td className="border px-1 py-0.5"></td>
            <td className="border px-1 py-0.5"></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
