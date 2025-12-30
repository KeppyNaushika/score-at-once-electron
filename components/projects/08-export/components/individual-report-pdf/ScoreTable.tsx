/**
 * スコアテーブルコンポーネント
 */
import { Text, View } from "@react-pdf/renderer"
import type {
  IndividualReportData,
  IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"
import { styles } from "./styles"

interface ScoreTableProps {
  report: IndividualReportData
  options: IndividualReportOptions
}

export function ScoreTable({ report, options }: ScoreTableProps) {
  const isDetailMode = options.displayMode === "detail"
  const data = isDetailMode
    ? report.scoringData.scores
    : report.scoringData.subtotalScores

  if (data.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {isDetailMode ? "設問別得点" : "小計別得点"}
      </Text>
      <View style={styles.table}>
        {/* ヘッダー */}
        <View style={styles.tableHeader}>
          <Text style={styles.tableCellLabel}>
            {isDetailMode ? "設問" : "小計"}
          </Text>
          <Text style={styles.tableCellNumber}>配点</Text>
          <Text style={styles.tableCellNumber}>得点</Text>
          {isDetailMode && options.showMarks && (
            <Text style={styles.tableCellMark}>評価</Text>
          )}
          <Text style={styles.tableCellNumber}>正答率</Text>
        </View>

        {/* データ行 */}
        {data.map((item, index) => {
          const isAlt = index % 2 === 1
          const label = isDetailMode
            ? (item as (typeof report.scoringData.scores)[0]).questionLabel
            : (item as (typeof report.scoringData.subtotalScores)[0])
                .subtotalLabel
          const maxScore = isDetailMode
            ? (item as (typeof report.scoringData.scores)[0]).maxScore
            : (item as (typeof report.scoringData.subtotalScores)[0]).maxScore
          const score = isDetailMode
            ? (item as (typeof report.scoringData.scores)[0]).score
            : (item as (typeof report.scoringData.subtotalScores)[0]).score

          // 正答率を取得
          let correctRate = 0
          if (isDetailMode) {
            const questionId = (item as (typeof report.scoringData.scores)[0])
              .questionId
            correctRate =
              report.statistics.questionCorrectRates[questionId] ?? 0
          }

          // 評価マークを取得
          let mark = ""
          let markStyle = {}
          if (isDetailMode) {
            const status = (item as (typeof report.scoringData.scores)[0])
              .status
            switch (status) {
              case "correct":
                mark = "○"
                markStyle = styles.markCorrect
                break
              case "incorrect":
                mark = "×"
                markStyle = styles.markIncorrect
                break
              case "partial":
                mark = "△"
                markStyle = styles.markPartial
                break
              case "no_answer":
                mark = "-"
                break
              default:
                mark = ""
            }
          }

          return (
            <View
              key={index}
              style={isAlt ? styles.tableRowAlt : styles.tableRow}
            >
              <Text style={styles.tableCellLabel}>
                {label.length > 20 ? label.substring(0, 20) + "..." : label}
              </Text>
              <Text style={styles.tableCellNumber}>{maxScore}</Text>
              <Text style={styles.tableCellNumber}>{score ?? "-"}</Text>
              {isDetailMode && options.showMarks && (
                <Text style={{ ...styles.tableCellMark, ...markStyle }}>
                  {mark}
                </Text>
              )}
              <Text style={styles.tableCellNumber}>
                {isDetailMode ? `${Math.round(correctRate)}%` : "-"}
              </Text>
            </View>
          )
        })}

        {/* 合計行 */}
        <View style={styles.totalRow}>
          <Text style={styles.tableCellLabel}>合計</Text>
          <Text style={styles.tableCellNumber}>
            {report.scoringData.totalMaxScore}
          </Text>
          <Text style={styles.tableCellNumber}>
            {report.scoringData.totalScore}
          </Text>
          {isDetailMode && options.showMarks && (
            <Text style={styles.tableCellMark}>-</Text>
          )}
          <Text style={styles.tableCellNumber}>
            {Math.round(
              (report.scoringData.totalScore /
                report.scoringData.totalMaxScore) *
                100
            )}
            %
          </Text>
        </View>
      </View>
    </View>
  )
}
