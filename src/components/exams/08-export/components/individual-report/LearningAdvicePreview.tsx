"use client"

/**
 * 学習アドバイスプレビューコンポーネント
 */
import type {
  AdviceOptions,
  LearningAdviceData,
} from "@/electron-src/lib/export/individual-report/types"

interface LearningAdvicePreviewProps {
  advice: LearningAdviceData
  options: AdviceOptions
  fontScale: number
}

export function LearningAdvicePreview({
  advice,
  options,
  fontScale,
}: LearningAdvicePreviewProps) {
  if (advice.reviewQuestions.length === 0) return null

  // 条件の説明文を生成
  const conditionText = buildConditionText(options)

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
        学習アドバイス
      </h2>

      <div
        style={{
          padding: "3mm 4mm",
          backgroundColor: "#fef3c7",
          borderRadius: "2mm",
          borderLeft: "3px solid #f59e0b",
        }}
      >
        <p
          style={{
            fontSize: `${12 * fontScale}px`,
            fontWeight: "bold",
            margin: "0 0 2mm 0",
            color: "#92400e",
          }}
        >
          復習しよう！{conditionText && `（${conditionText}）`}
        </p>
        <p
          style={{
            fontSize: `${11 * fontScale}px`,
            margin: 0,
            color: "#78350f",
          }}
        >
          {advice.reviewQuestions.map((question, i) => (
            <span key={question.questionId}>
              {i > 0 && "、"}
              <strong>{question.label}</strong>
              <span
                style={{
                  fontSize: `${10 * fontScale}px`,
                  color: "#a16207",
                }}
              >
                （正答率{Math.round(question.correctRate)}%）
              </span>
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}

/**
 * 条件の説明文を生成
 */
function buildConditionText(options: AdviceOptions): string {
  const parts: string[] = []

  if (options.reviewRateMin !== null && options.reviewRateMax !== null) {
    parts.push(`正答率${options.reviewRateMin}%〜${options.reviewRateMax}%`)
  } else if (options.reviewRateMin !== null) {
    parts.push(`正答率${options.reviewRateMin}%以上`)
  } else if (options.reviewRateMax !== null) {
    parts.push(`正答率${options.reviewRateMax}%以下`)
  }

  if (options.reviewQuestionCount !== null) {
    parts.push(`上位${options.reviewQuestionCount}問`)
  }

  return parts.join("・")
}
