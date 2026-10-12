import type { FinalizeExportTermId } from "../../categories/finalizeExportCategory"
import type { GlossaryTermText } from "../../types"

export const FINALIZE_EXPORT_TEXT_JA: Record<
  FinalizeExportTermId,
  GlossaryTermText
> = {
  scoreDecision: {
    label: "採点確定",
    summary:
      "試験の所有者が生徒×設問ごとに決める最終の結果（「8. 採点確定」）。判定・得点・覚え書き・類型を持つ。どの採点者の結果を採ったかは持たない。",
    variants: ["確定", "裁定", "確定した得点", "採点の確定"],
    avoidedAliases: [],
    distinctions: {
      questionScore:
        "採点は採点者ごとの結果。採点確定はそれを1つに決めたもの。",
      gradeFrozenScore:
        "成績の固定は成績算出の値を固定するもので、採点確定とは関係しない。",
    },
  },
  scoreConflict: {
    label: "採点の不一致",
    summary:
      "同じ生徒×設問で、採点者どうしの結果が違う状態。採点確定するまでは未採点として出力される。表や列は持たず、採点から導く。",
    variants: [],
    avoidedAliases: ["食い違い", "要裁定", "採点競合", "競合の記録"],
    distinctions: {
      decisionStale:
        "要再確認は、確定した後に新しい採点が入ったマス。採点の不一致は、まだ採点確定していない違い。",
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
      "教員が手で描いた◯✕△の画像を、採点状態に応じて答案へ重ねるもの。どの採点状態で描くかは「採点マーク表示対象」で選ぶ。",
    variants: [],
    avoidedAliases: [],
    distinctions: {
      drawingAnnotation:
        "注釈は1枚の答案の上に描く印で、採点マークとは別のもの。",
    },
  },
  answerOverlay: {
    label: "採点マークと点数の表示設定",
    summary:
      "採点した答案に重ねる4つの要素（採点マーク・設問の得点・小計点・合計点）の位置と見た目と、採点状態ごとに描くかどうかの、試験ごとの設定。「9. 結果と出力」にある。",
    variants: [],
    avoidedAliases: ["採点マーク設定", "答案の重ね表示"],
    distinctions: {},
  },
  individualReport: {
    label: "試験採点結果個表",
    summary:
      "生徒1人ずつに渡す試験の採点結果（PDF）。設問の表・小計点の表・統計・箱ひげ図・学習アドバイス・コメント欄などを試験ごとに設定する。",
    variants: [],
    avoidedAliases: ["個人成績表", "個票"],
    distinctions: {
      gradeIndividualReport:
        "個人成績通知書は成績算出の結果を印刷するもので、設定も出力も別。",
    },
  },
  returnSnapshot: {
    label: "返却版",
    summary:
      "答案を返したときの採点と注釈の写し（受験生徒ごとに最新の1つ）。後で採点を直した生徒だけを選んで刷り直すときの基準になる。",
    variants: ["返却版として記録", "答案返却・差分"],
    avoidedAliases: [],
    distinctions: {},
  },
}
