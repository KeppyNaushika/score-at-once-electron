/**
 * 学習アドバイスセクションコンポーネント
 */
import { Text, View } from "@react-pdf/renderer"
import type {
  LearningAdviceData,
  AdviceOptions,
} from "@/electron-src/lib/export/individual-report/types"
import { styles } from "./styles"

interface LearningAdviceSectionProps {
  advice: LearningAdviceData
  options: AdviceOptions
}

export function LearningAdviceSection({
  advice,
  options,
}: LearningAdviceSectionProps) {
  const hasDifferentiating =
    options.showDifferentiatingQuestions &&
    advice.differentiatingQuestions.length > 0
  const hasMustReview =
    options.showMustReviewQuestions && advice.mustReviewQuestions.length > 0

  if (!hasDifferentiating && !hasMustReview) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>学習アドバイス</Text>

      {/* 差がつく問題 */}
      {hasDifferentiating && (
        <View style={styles.adviceSection}>
          <Text style={styles.adviceTitle}>
            📚 差がつく問題（正答率 {options.differentiatingRateMin}〜
            {options.differentiatingRateMax}%）
          </Text>
          <Text style={{ fontSize: 8, color: "#666", marginBottom: 5 }}>
            この範囲の問題を解けるようになると、成績が大きく伸びます
          </Text>
          {advice.differentiatingQuestions.map((q, index) => (
            <Text key={index} style={styles.adviceItem}>
              • {q.label}（正答率: {Math.round(q.correctRate)}%、あなた:{" "}
              {q.yourScore}/{q.maxScore}点）
            </Text>
          ))}
        </View>
      )}

      {/* 必ず復習問題 */}
      {hasMustReview && (
        <View style={{ ...styles.adviceSection, backgroundColor: "#fef2f2" }}>
          <Text style={styles.adviceTitle}>
            ⚠️ 必ず復習（正答率 {options.mustReviewRateMin}%以上）
          </Text>
          <Text style={{ fontSize: 8, color: "#666", marginBottom: 5 }}>
            多くの人が解けている問題です。確実に得点できるようにしましょう
          </Text>
          {advice.mustReviewQuestions.map((q, index) => (
            <Text key={index} style={styles.adviceItem}>
              • {q.label}（正答率: {Math.round(q.correctRate)}%、あなた:{" "}
              {q.yourScore}/{q.maxScore}点）
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}
