"use client"

/**
 * スコアテーブルプレビューコンポーネント
 * 列数表示とフォントサイズに対応
 */
import type {
  FontSizeOption,
  IndividualReportData,
  IndividualReportOptions,
  TableColumns,
} from "@/electron-src/lib/export/individual-report/types"

interface ScoreTablePreviewProps {
  report: IndividualReportData
  options: IndividualReportOptions
  fontScale: number
}

/** フォントサイズ設定からスケール値を取得 */
function getFontSizeScale(fontSize: FontSizeOption): number {
  // FontSizeOptionは数値（px単位）なので、11pxを基準としてスケールを計算
  return fontSize / 11
}

/** 得点/配点の表示コンポーネント */
function ScoreDisplay({
  score,
  maxScore,
  fontSize,
}: {
  score: number | null
  maxScore: number
  fontSize: number
}) {
  return (
    <span>
      {score ?? "-"}
      <span style={{ fontSize: `${fontSize * 0.8}px`, color: "#666" }}>
        {" "}
        / {maxScore}
      </span>
    </span>
  )
}

export function ScoreTablePreview({
  report,
  options,
  fontScale,
}: ScoreTablePreviewProps) {
  const data = report.scoringData.scores
  const columns = options.questionTableColumns
  const tableFontScale =
    fontScale * getFontSizeScale(options.questionTableFontSize)

  if (data.length === 0) return null

  // 1列表示の場合は従来のテーブル形式
  if (columns === 1) {
    return (
      <SingleColumnTable
        report={report}
        options={options}
        fontScale={tableFontScale}
      />
    )
  }

  // 複数列表示の場合はグリッド形式
  return (
    <MultiColumnTable
      report={report}
      options={options}
      fontScale={tableFontScale}
      columns={columns}
    />
  )
}

/**
 * 1列表示（従来形式）
 */
function SingleColumnTable({
  report,
  options,
  fontScale,
}: {
  report: IndividualReportData
  options: IndividualReportOptions
  fontScale: number
}) {
  const data = report.scoringData.scores
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
          {data.map((item, index) => {
            const isAlt = index % 2 === 1
            const rowStyle: React.CSSProperties = {
              backgroundColor: isAlt ? "#fafafa" : "transparent",
            }

            const correctRate =
              report.statistics.questionCorrectRates[item.questionId] ?? 0
            const scoreRate =
              report.statistics.questionScoreRates?.[item.questionId] ?? 0

            const { mark, markColor } = getMarkInfo(item.status)

            return (
              <tr key={index} style={rowStyle}>
                <td style={{ ...cellStyle, textAlign: "left" }}>
                  {item.questionLabel.length > 30
                    ? item.questionLabel.substring(0, 30) + "..."
                    : item.questionLabel}
                </td>
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  <ScoreDisplay
                    score={item.score}
                    maxScore={item.maxScore}
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
                {Math.round(
                  (report.scoringData.totalScore /
                    report.scoringData.totalMaxScore) *
                    100
                )}
                %
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/**
 * 複数列表示（グリッド形式）
 */
function MultiColumnTable({
  report,
  options,
  fontScale,
  columns,
}: {
  report: IndividualReportData
  options: IndividualReportOptions
  fontScale: number
  columns: TableColumns
}) {
  const data = report.scoringData.scores
  const baseFontSize = 10 * fontScale

  // データを列数で分割
  const rowsPerColumn = Math.ceil(data.length / columns)
  const columnData: (typeof data)[] = []
  for (let i = 0; i < columns; i++) {
    const start = i * rowsPerColumn
    const end = Math.min(start + rowsPerColumn, data.length)
    columnData.push(data.slice(start, end))
  }

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
        {columnData.map((colData, colIndex) => (
          <div key={colIndex} style={{ width: columnWidth }}>
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
                {colData.map((item, index) => {
                  const isAlt = index % 2 === 1
                  const rowStyle: React.CSSProperties = {
                    backgroundColor: isAlt ? "#fafafa" : "transparent",
                  }

                  const { mark, markColor } = getMarkInfo(item.status)

                  // ラベルを短縮
                  const shortLabel =
                    item.questionLabel.length > 8
                      ? item.questionLabel.substring(0, 8) + "…"
                      : item.questionLabel

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
                        title={item.questionLabel}
                      >
                        {shortLabel}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "center" }}>
                        <ScoreDisplay
                          score={item.score}
                          maxScore={item.maxScore}
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
                            report.statistics.questionCorrectRates[
                              item.questionId
                            ] ?? 0
                          )}
                          %
                        </td>
                      )}
                      {options.showScoreRate && (
                        <td style={{ ...cellStyle, textAlign: "center" }}>
                          {Math.round(
                            report.statistics.questionScoreRates?.[
                              item.questionId
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
          {report.scoringData.totalScore}
          <span
            style={{ fontSize: `${11 * fontScale * 0.8}px`, color: "#666" }}
          >
            {" "}
            / {report.scoringData.totalMaxScore}
          </span>{" "}
          (
          {Math.round(
            (report.scoringData.totalScore / report.scoringData.totalMaxScore) *
              100
          )}
          %)
        </span>
      </div>
    </section>
  )
}

/**
 * 評価マーク情報を取得
 */
function getMarkInfo(status: string): { mark: string; markColor: string } {
  switch (status) {
    case "correct":
      return { mark: "○", markColor: "#16a34a" }
    case "incorrect":
      return { mark: "×", markColor: "#dc2626" }
    case "partial":
      return { mark: "△", markColor: "#ca8a04" }
    case "no_answer":
      return { mark: "-", markColor: "#666" }
    default:
      return { mark: "", markColor: "#333" }
  }
}
