/**
 * 個人成績表PDFドキュメント
 * React-PDFを使用してベクターPDFを生成
 */
import {
  Document,
  Page,
  Text,
  View,
  Font,
} from "@react-pdf/renderer"
import type {
  IndividualReportData,
  IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"
import { styles } from "./styles"
import { ScoreTable } from "./ScoreTable"
import { ChartSection } from "./ChartSection"
import { LearningAdviceSection } from "./LearningAdviceSection"

// 日本語フォントの登録（Noto Sans JP）
// public/fonts/ に配置したフォントファイルを使用
// scripts/setup-mathjax-fonts.js でビルド時にコピーされる
// window.location.origin を使用して動的にURLを解決
const getFontBaseUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/fonts`
  }
  // SSR時のフォールバック（実際には使用されない）
  return "http://localhost:3000/fonts"
}

// フォント登録は遅延初期化
let fontRegistered = false
export function registerFonts() {
  if (fontRegistered) return
  const baseUrl = getFontBaseUrl()
  Font.register({
    family: "NotoSansJP",
    fonts: [
      {
        src: `${baseUrl}/noto-sans-jp-japanese-400-normal.woff`,
        fontWeight: "normal",
      },
      {
        src: `${baseUrl}/noto-sans-jp-japanese-700-normal.woff`,
        fontWeight: "bold",
      },
    ],
  })
  fontRegistered = true
}

interface IndividualReportDocumentProps {
  reports: IndividualReportData[]
  options: IndividualReportOptions
}

export function IndividualReportDocument({
  reports,
  options,
}: IndividualReportDocumentProps) {
  return (
    <Document>
      {reports.map((report, index) => (
        <Page
          key={report.studentInfo.id}
          size="A4"
          orientation={options.pageOrientation}
          style={{
            ...styles.page,
            fontFamily: "NotoSansJP",
          }}
        >
          {/* ヘッダー: 試験情報 */}
          <View style={styles.header}>
            <View>
              <Text style={styles.examName}>{report.examInfo.examName}</Text>
              {report.examInfo.subject && (
                <Text style={styles.examDate}>{report.examInfo.subject}</Text>
              )}
            </View>
            <View>
              {report.examInfo.examDate && (
                <Text style={styles.examDate}>
                  {formatDate(report.examInfo.examDate)}
                </Text>
              )}
              <Text style={styles.examDate}>個人成績表</Text>
            </View>
          </View>

          {/* 生徒情報 */}
          <View style={styles.studentInfo}>
            <View>
              <Text style={styles.studentName}>
                {report.studentInfo.fullName}
              </Text>
              <Text style={styles.studentDetail}>
                {report.studentInfo.studentNumber}
              </Text>
            </View>
            <View>
              <Text style={styles.studentDetail}>
                {report.studentInfo.grade && `${report.studentInfo.grade}年`}
                {report.studentInfo.className && ` ${report.studentInfo.className}`}
                {report.studentInfo.attendanceNumber != null &&
                  ` ${report.studentInfo.attendanceNumber}番`}
              </Text>
            </View>
          </View>

          {/* 統計サマリー */}
          <View style={styles.statsSummary}>
            {options.showScore && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>得点</Text>
                <Text style={styles.statValue}>
                  {report.scoringData.totalScore} / {report.scoringData.totalMaxScore}
                </Text>
              </View>
            )}
            {options.showAverage !== "none" && (
              <>
                {(options.showAverage === "class" || options.showAverage === "both") && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>学級平均</Text>
                    <Text style={styles.statValue}>
                      {report.statistics.class.average.toFixed(1)}
                    </Text>
                  </View>
                )}
                {(options.showAverage === "overall" || options.showAverage === "both") && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>全体平均</Text>
                    <Text style={styles.statValue}>
                      {report.statistics.overall.average.toFixed(1)}
                    </Text>
                  </View>
                )}
              </>
            )}
            {options.showDeviation && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>偏差値</Text>
                <Text style={styles.statValue}>
                  {report.statistics.personal.deviation.toFixed(1)}
                </Text>
              </View>
            )}
            {options.showRank && (
              <>
                {(options.rankType === "class" || options.rankType === "both") && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>学級順位</Text>
                    <Text style={styles.statValue}>
                      {report.statistics.personal.classRank} / {report.statistics.class.total}
                    </Text>
                  </View>
                )}
                {(options.rankType === "overall" || options.rankType === "both") && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>全体順位</Text>
                    <Text style={styles.statValue}>
                      {report.statistics.personal.overallRank} / {report.statistics.overall.total}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* スコアテーブル */}
          <ScoreTable report={report} options={options} />

          {/* グラフセクション */}
          {options.showGraph && (
            <ChartSection report={report} options={options} />
          )}

          {/* 学習アドバイス */}
          {options.showLearningAdvice && (
            <LearningAdviceSection
              advice={report.learningAdvice}
              options={options.adviceOptions}
            />
          )}

          {/* コメント欄 */}
          {options.showComment && (
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>コメント:</Text>
            </View>
          )}

          {/* 署名欄 */}
          {options.showSignature && (
            <View style={styles.signatureSection}>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>保護者印</Text>
                <View style={styles.signatureArea} />
              </View>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>担任印</Text>
                <View style={styles.signatureArea} />
              </View>
            </View>
          )}
        </Page>
      ))}
    </Document>
  )
}

function formatDate(date: Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
