import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/types/individualReport.types"

import { getMarkInfo } from "./questionMark"
import { ScoreDisplay } from "./ScoreDisplay"

/**
 * 1列表示（従来形式）
 */
export function SingleColumnScoreTable({
  report,
  population,
  options,
  fontScale,
}: {
  report: IndividualReportData
  population: ReportPopulation
  options: IndividualReportOptions
  fontScale: number
}) {
  const questionScores = report.scoringData.scores
  const baseFontSize = 11 * fontScale

  const cellStyle: React.CSSProperties = {
    padding: "2mm 3mm",
    borderBottom: "1px solid #e0e0e0",
    fontSize: `${baseFontSize}px`,
  }

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    borderBottom: "2px solid #ccc",
  }

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

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: `${baseFontSize}px`,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, textAlign: "left", width: "45%" }}>
              設問
            </th>
            <th
              style={{ ...headerCellStyle, textAlign: "center", width: "25%" }}
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
                評価
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
          {questionScores.map((questionScore, index) => {
            const isAlt = index % 2 === 1
            const rowStyle: React.CSSProperties = {
              backgroundColor: isAlt ? "#fafafa" : "transparent",
            }

            const correctRate =
              population.questionCorrectRates[questionScore.questionId] ?? 0
            const scoreRate =
              population.questionScoreRates[questionScore.questionId] ?? 0

            const { mark, markColor } = getMarkInfo(questionScore.status)

            return (
              <tr key={index} style={rowStyle}>
                <td style={{ ...cellStyle, textAlign: "left" }}>
                  {questionScore.questionLabel.length > 30
                    ? questionScore.questionLabel.substring(0, 30) + "..."
                    : questionScore.questionLabel}
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
                    {Math.round(correctRate)}%
                  </td>
                )}
                {options.showScoreRate && (
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    {Math.round(scoreRate)}%
                  </td>
                )}
              </tr>
            )
          })}

          {/* 合計行 */}
          <tr
            style={{
              backgroundColor: "#e8f4fd",
              fontWeight: "bold",
            }}
          >
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: "bold" }}>
              合計
            </td>
            <td
              style={{ ...cellStyle, textAlign: "center", fontWeight: "bold" }}
            >
              <ScoreDisplay
                score={report.scoringData.totalScore}
                maxScore={report.scoringData.totalMaxScore}
                fontSize={baseFontSize}
              />
            </td>
            {options.showMarks && (
              <td style={{ ...cellStyle, textAlign: "center" }}>-</td>
            )}
            {options.showCorrectRate && (
              <td
                style={{
                  ...cellStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                -
              </td>
            )}
            {options.showScoreRate && (
              <td
                style={{
                  ...cellStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {report.scoringData.totalScore !== null
                  ? `${Math.round(
                      (report.scoringData.totalScore /
                        report.scoringData.totalMaxScore) *
                        100
                    )}%`
                  : "-"}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </section>
  )
}
