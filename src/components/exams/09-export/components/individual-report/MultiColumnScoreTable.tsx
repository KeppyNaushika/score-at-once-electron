import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
  TableColumns,
} from "@/types/individualReport.types"

import { getMarkInfo } from "./questionMark"
import { ScoreDisplay } from "./ScoreDisplay"

/**
 * 複数列表示（グリッド形式）
 */
export function MultiColumnScoreTable({
  report,
  population,
  options,
  fontScale,
  columns,
}: {
  report: IndividualReportData
  population: ReportPopulation
  options: IndividualReportOptions
  fontScale: number
  columns: TableColumns
}) {
  const questionScores = report.scoringData.scores
  const baseFontSize = 10 * fontScale

  // 設問を列数ぶんに分割
  const rowsPerColumn = Math.ceil(questionScores.length / columns)
  const questionScoreColumns = Array.from(
    { length: columns },
    (_unused, columnIndex) =>
      questionScores.slice(
        columnIndex * rowsPerColumn,
        columnIndex * rowsPerColumn + rowsPerColumn
      )
  )

  const cellStyle: React.CSSProperties = {
    padding: `${1.5 * fontScale}mm ${2 * fontScale}mm`,
    borderBottom: "1px solid #e0e0e0",
    fontSize: `${baseFontSize}px`,
  }

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    borderBottom: "2px solid #ccc",
  }

  const columnWidth = `${100 / columns}%`

  return (
    <section style={{ marginBottom: "6mm" }}>
      <h2
        style={{
          fontSize: `${14 * fontScale}px`,
          fontWeight: "bold",
          marginBottom: "4mm",
          paddingBottom: "2mm",
          borderBottom: "1px solid #ddd",
        }}
      >
        設問別得点
      </h2>

      <div style={{ display: "flex", gap: "2mm" }}>
        {questionScoreColumns.map((columnQuestionScores, columnIndex) => (
          <div key={columnIndex} style={{ width: columnWidth }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: `${baseFontSize}px`,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...headerCellStyle,
                      textAlign: "left",
                      width: "45%",
                    }}
                  >
                    設問
                  </th>
                  <th
                    style={{
                      ...headerCellStyle,
                      textAlign: "center",
                      width: "30%",
                    }}
                  >
                    得点
                  </th>
                  {options.showMarks && (
                    <th
                      style={{
                        ...headerCellStyle,
                        textAlign: "center",
                        width: "10%",
                      }}
                    >
                      ○×
                    </th>
                  )}
                  {options.showCorrectRate && (
                    <th
                      style={{
                        ...headerCellStyle,
                        textAlign: "center",
                        width: "15%",
                      }}
                    >
                      正答率
                    </th>
                  )}
                  {options.showScoreRate && (
                    <th
                      style={{
                        ...headerCellStyle,
                        textAlign: "center",
                        width: "15%",
                      }}
                    >
                      得点率
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {columnQuestionScores.map((questionScore, index) => {
                  const isAlt = index % 2 === 1
                  const rowStyle: React.CSSProperties = {
                    backgroundColor: isAlt ? "#fafafa" : "transparent",
                  }

                  const { mark, markColor } = getMarkInfo(questionScore.status)

                  // ラベルを短縮
                  const shortLabel =
                    questionScore.questionLabel.length > 8
                      ? questionScore.questionLabel.substring(0, 8) + "…"
                      : questionScore.questionLabel

                  return (
                    <tr key={index} style={rowStyle}>
                      <td
                        style={{
                          ...cellStyle,
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "0",
                        }}
                        title={questionScore.questionLabel}
                      >
                        {shortLabel}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "center" }}>
                        <ScoreDisplay
                          score={questionScore.score}
                          maxScore={questionScore.maxScore}
                          fontSize={baseFontSize}
                        />
                      </td>
                      {options.showMarks && (
                        <td
                          style={{
                            ...cellStyle,
                            textAlign: "center",
                            color: markColor,
                            fontWeight: "bold",
                          }}
                        >
                          {mark}
                        </td>
                      )}
                      {options.showCorrectRate && (
                        <td style={{ ...cellStyle, textAlign: "center" }}>
                          {Math.round(
                            population.questionCorrectRates[
                              questionScore.questionId
                            ] ?? 0
                          )}
                          %
                        </td>
                      )}
                      {options.showScoreRate && (
                        <td style={{ ...cellStyle, textAlign: "center" }}>
                          {Math.round(
                            population.questionScoreRates[
                              questionScore.questionId
                            ] ?? 0
                          )}
                          %
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* 合計行 */}
      <div
        style={{
          marginTop: "2mm",
          padding: "2mm 3mm",
          backgroundColor: "#e8f4fd",
          borderRadius: "2mm",
          display: "flex",
          justifyContent: "space-between",
          fontSize: `${11 * fontScale}px`,
          fontWeight: "bold",
        }}
      >
        <span>合計</span>
        <span>
          {report.scoringData.totalScore ?? "-"}
          <span
            style={{ fontSize: `${11 * fontScale * 0.8}px`, color: "#666" }}
          >
            {" "}
            / {report.scoringData.totalMaxScore}
          </span>{" "}
          (
          {report.scoringData.totalScore !== null
            ? `${Math.round(
                (report.scoringData.totalScore /
                  report.scoringData.totalMaxScore) *
                  100
              )}%`
            : "-"}
          )
        </span>
      </div>
    </section>
  )
}
