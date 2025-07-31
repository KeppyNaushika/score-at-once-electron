import { DEFAULT_SHORTCUTS } from "@/components/projects/07-score-at-once/hooks/useScoringKeyboard"

// キーの表示名マッピング
export const KEY_DISPLAY_NAMES: { [key: string]: string } = {
  q: "Q",
  e: "E",
  f: "F",
  j: "J",
  o: "O",
  p: "P",
  ArrowRight: "→",
  ArrowLeft: "←",
  ArrowDown: "↓",
  ArrowUp: "↑",
  "=": "=",
  "-": "-",
  "0": "0",
}

// 各設定の日本語名
export const SHORTCUT_LABELS: {
  [key in keyof typeof DEFAULT_SHORTCUTS]: string
} = {
  unscored: "未採点",
  correct: "正答",
  partial: "部分点",
  pending: "保留",
  incorrect: "誤答",
  no_answer: "無答",
  nextQuestion: "次の設問",
  prevQuestion: "前の設問",
  nextStudent: "次の生徒",
  prevStudent: "前の生徒",
  save: "保存",
  zoomIn: "拡大",
  zoomOut: "縮小",
  resetZoom: "ズームリセット",
  fullView: "全体表示切替",
  moveUp: "上に移動",
  moveLeft: "左に移動",
  moveDown: "下に移動",
  moveRight: "右に移動",
  refreshFilter: "フィルタ更新",
  toggleNames: "名前表示切替",
  nextQuestionShift: "次の設問（Shift）",
  prevQuestionShift: "前の設問（Shift）",
}

// カテゴリ別の設定項目
export const SHORTCUT_CATEGORIES = {
  scoring: {
    label: "採点操作",
    keys: [
      "correct",
      "partial",
      "pending",
      "incorrect",
      "no_answer",
      "unscored",
    ] as const,
    description: "採点状態を設定するキー",
  },
  navigation: {
    label: "ナビゲーション",
    keys: [
      "nextQuestion",
      "prevQuestion",
      "nextStudent",
      "prevStudent",
      "nextQuestionShift",
      "prevQuestionShift",
    ] as const,
    description: "設問や生徒の移動",
  },
  view: {
    label: "表示制御",
    keys: [
      "zoomIn",
      "zoomOut",
      "resetZoom",
      "fullView",
      "toggleNames",
    ] as const,
    description: "表示の拡大・縮小・切替",
  },
  movement: {
    label: "画面移動",
    keys: ["moveUp", "moveLeft", "moveDown", "moveRight"] as const,
    description: "画面の移動操作",
  },
  other: {
    label: "その他",
    keys: ["save", "refreshFilter"] as const,
    description: "保存・更新など",
  },
} as const
