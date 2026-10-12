import type { AiGradingTermId } from "../../categories/aiGradingCategory"
import type { GlossaryTermText } from "../../types"

export const AI_GRADING_TEXT_JA: Record<AiGradingTermId, GlossaryTermText> = {
  aiGrading: {
    label: "AI採点",
    summary:
      "答案の画像を AI に送って判定させる、実験的な機能。AI の判定は、教員が採用するまで点にならない。",
    variants: [],
    avoidedAliases: ["AI 採点", "VLM 採点"],
    distinctions: {
      aiCheck:
        "AIチェックは、採点済みの答案を AI に判定させて自分の採点と比べる。",
    },
  },
  aiPrompt: {
    label: "採点指示",
    summary:
      "設問ごとに AI へ渡す文面（問題文・模範解答・採点基準・助言の文案の指示）と問題の画像。直すと新しい採点指示ができ、元は残る。",
    variants: ["指示"],
    avoidedAliases: ["プロンプト"],
    distinctions: {
      rubricItem:
        "採点項目は教員が使う採点の基準。採点指示の「採点基準」は AI に渡す文。",
    },
  },
  aiGradingRun: {
    label: "AI採点の実行",
    summary:
      "AI へ送った1回の依頼。目的（採点・チェック）・事業者・モデル・送り方（すぐに・バッチ）・状態を記録する。",
    variants: ["採点 N", "チェック N"],
    avoidedAliases: [],
    distinctions: {
      aiGradingAttempt: "判定は、実行の中の答案1件ごとの結果。",
    },
  },
  aiGradingAttempt: {
    label: "判定（AI）",
    summary:
      "答案1件に対する AI の1回の判定。送信の成否と、採点の判定（正答・誤答など）を別々に持つ。教員が採用したときだけ、その教員の採点へ写す。",
    variants: ["AI提案"],
    avoidedAliases: ["試行"],
    distinctions: {
      questionScore:
        "採点は教員自身の結果。AI の判定は別に持ち、採用するまで出力にも成績算出にも入らない。",
    },
  },
  aiConfidence: {
    label: "確信度",
    summary:
      "AI が自分の判定に付ける自信の度合い（高・中・低）。低・中のものは見直しの対象として目立たせる。",
    variants: [],
    avoidedAliases: [],
    distinctions: {},
  },
  aiRubricProposal: {
    label: "項目の案",
    summary:
      "AI が判定をまとめて作る「こういう特徴の答案が N 件ある」という案。選択肢と当てはまる答案を持ち、教員が答えて採点に反映すると、採点項目と得点に入る。",
    variants: ["AI採点の項目の案", "問い"],
    avoidedAliases: [],
    distinctions: {
      rubricItem:
        "採点項目は教員が決めた基準。項目の案は採点に反映するまでは案。",
    },
  },
  aiQuestioning: {
    label: "問いかけ",
    summary:
      "AI採点・AIチェックで、案や AI と自分の採点の違いを1問ずつ教員に尋ねる流れ。答えは積み上がり、最後に見直して採点に反映する。",
    variants: ["問い"],
    avoidedAliases: [],
    distinctions: {
      scoreDecision:
        "採点確定は採点者どうしの採点の不一致を決める。問いかけは AI との違いを決める。",
    },
  },
  aiCheck: {
    label: "AIチェック",
    summary:
      "採点済みの答案を AI に判定させ、自分の採点との違いや「同じ答えに違う点」を見つける機能。教員の点は AI に送らない。",
    variants: ["チェック", "AI≠自分"],
    avoidedAliases: [],
    distinctions: {},
  },
}
