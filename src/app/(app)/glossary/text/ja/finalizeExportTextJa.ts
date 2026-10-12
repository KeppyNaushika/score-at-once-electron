import type { FinalizeExportTermId } from "../../categories/finalizeExportCategory"
import type { GlossaryTermText } from "../../types"

export const FINALIZE_EXPORT_TEXT_JA: Record<
  FinalizeExportTermId,
  GlossaryTermText
> = {
  scoreDecision: {
    label: "採点確定",
    summary:
      "試験のオーナーが生徒×設問ごとに決める最終の結果（「8. 採点確定」）。判定・点・覚え書き・類型を持つ。どの採点者の結果を採ったかは持たない。",
    variants: ["確定", "裁定", "確定した点数", "採点の確定"],
    avoidedAliases: [],
    distinctions: {
      questionScore:
        "採点は採点者ごとの結果。採点確定はそれを1つに決めたもの。",
      gradeFrozenScore:
        "成績の確定は成績算出の値を固定するもので、採点確定とは関係しない。",
    },
  },
  scoreConflict: {
    label: "食い違い",
    summary:
      "同じ生徒×設問で、採点者どうしの結果が違う状態。採点確定するまでは未採点として出力される。表や列は持たず、採点から導く。",
    variants: ["要裁定", "採点競合", "競合"],
    avoidedAliases: [],
    distinctions: {
      decisionStale:
        "要再確認は、確定した後に新しい採点が入ったマス。食い違いは、まだ確定していない違い。",
    },
  },
  decisionStale: {
    label: "要再確認",
    summary:
      "採点確定の後に新しい採点が入ったマス。確かめて、必要なら確定し直す。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  scoringMark: {
    label: "採点マーク",
    summary:
      "採点状態に応じて答案に自動で重ねる○×などの印。どの採点状態で描くかは「採点マーク表示対象」で選ぶ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      drawingAnnotation:
        "書き込みは教員が手で描く印。操作履歴と返却版の差分では書き込みも「採点マーク」と出ているが、別のもの。",
    },
  },
  answerOverlay: {
    label: "採点マーク設定",
    summary:
      "採点した答案に重ねる4つの要素（採点マーク・設問部分点数・小計点数・合計点数）の位置と見た目、採点状態ごとに描くかどうかの、試験ごとの設定。",
    variants: ["答案の重ね表示"],
    avoidedAliases: [],
    distinctions: {},
  },
  individualReport: {
    label: "個人成績表",
    summary:
      "生徒1人ずつに渡す試験の成績票（PDF）。設問の表・小計点の表・統計・箱ひげ図・学習アドバイス・コメント欄などを試験ごとに設定する。",
    variants: ["個票"],
    avoidedAliases: [],
    distinctions: {
      gradeIndividualReport:
        "個人成績通知書は成績算出の結果を印刷するもので、設定も出力も別。",
    },
  },
  returnSnapshot: {
    label: "返却版",
    summary:
      "答案を返したときの採点と書き込みの写し（受験生徒ごとに最新の1つ）。後で採点を直した生徒だけを選んで刷り直すときの基準になる。",
    variants: ["返却版として記録", "答案返却・差分"],
    avoidedAliases: [],
    distinctions: {},
  },
}
