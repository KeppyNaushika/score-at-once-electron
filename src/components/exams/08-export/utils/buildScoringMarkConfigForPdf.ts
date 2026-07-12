import type { ScoringMarkConfig } from "@/components/exams/08-export/components/ScoringMarkSettings"
import type { ScoringMarkConfigForPdf } from "@/components/exams/08-export/utils/pdfCanvasRenderer"

/**
 * 採点マーク設定（画面編集用の ScoringMarkConfig）を、Canvas/PDF 描画用の
 * ScoringMarkConfigForPdf 形式へ変換する。部分点・小計点・合計点の各設定は
 * 新形式（partialScore/subtotalScore/totalScore）を優先し、無ければ旧形式
 * （summaryScore・scorePosition 等）からフォールバックする。
 */
export function buildScoringMarkConfigForPdf(
  scoringMarkConfig: ScoringMarkConfig
): ScoringMarkConfigForPdf {
  // 部分点設定を取得（partialScoreが存在する場合はそれを使用、なければ旧式設定からフォールバック）
  const partialScore = scoringMarkConfig.partialScore
  const partialScoreConfig =
    partialScore && partialScore.size !== undefined
      ? partialScore
      : {
          position: scoringMarkConfig.scorePosition || "middle-center",
          size: scoringMarkConfig.scoreSize || 14,
          offsetX: scoringMarkConfig.scoreOffsetX || 0,
          offsetY: scoringMarkConfig.scoreOffsetY || 0,
          color: "#ef4444",
          opacity: 100,
        }

  // 小計点設定を取得（subtotalScore → summaryScore → デフォルトの順でフォールバック）
  const subtotalScoreConfig = scoringMarkConfig.subtotalScore ??
    scoringMarkConfig.summaryScore ?? {
      position: "middle-center",
      size: 18,
      offsetX: 0,
      offsetY: 0,
      color: "#2563eb",
      opacity: 100,
    }

  // 合計点設定を取得（totalScore → summaryScore → デフォルトの順でフォールバック）
  const totalScoreConfig = scoringMarkConfig.totalScore ??
    scoringMarkConfig.summaryScore ?? {
      position: "middle-center",
      size: 18,
      offsetX: 0,
      offsetY: 0,
      color: "#2563eb",
      opacity: 100,
    }

  return {
    markPosition: scoringMarkConfig.markPosition,
    markSize: scoringMarkConfig.markSize,
    markColor: scoringMarkConfig.markColor ?? "#ef4444",
    markOpacity: scoringMarkConfig.markOpacity ?? 100,
    showPartialScore: true,
    partialScorePosition: partialScoreConfig.position || "middle-center",
    partialScoreSize: partialScoreConfig.size || 14,
    partialScoreOffsetX: partialScoreConfig.offsetX || 0,
    partialScoreOffsetY: partialScoreConfig.offsetY || 0,
    partialScoreColor: partialScoreConfig.color ?? "#ef4444",
    partialScoreOpacity: partialScoreConfig.opacity ?? 100,
    // 小計点用設定
    subtotalScorePosition: subtotalScoreConfig.position || "middle-center",
    subtotalScoreSize: subtotalScoreConfig.size || 18,
    subtotalScoreOffsetX: subtotalScoreConfig.offsetX || 0,
    subtotalScoreOffsetY: subtotalScoreConfig.offsetY || 0,
    subtotalScoreColor: subtotalScoreConfig.color ?? "#2563eb",
    subtotalScoreOpacity: subtotalScoreConfig.opacity ?? 100,
    // 合計点用設定
    totalScorePosition: totalScoreConfig.position || "middle-center",
    totalScoreSize: totalScoreConfig.size || 18,
    totalScoreOffsetX: totalScoreConfig.offsetX || 0,
    totalScoreOffsetY: totalScoreConfig.offsetY || 0,
    totalScoreColor: totalScoreConfig.color ?? "#2563eb",
    totalScoreOpacity: totalScoreConfig.opacity ?? 100,
    // ステータスごとの表示設定
    showMarkForStatus: scoringMarkConfig.showMarkForStatus,
    showScoreForStatus: scoringMarkConfig.showScoreForStatus,
  }
}
