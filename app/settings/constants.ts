import { DEFAULT_KEYBINDINGS } from "@/components/projects/07-score-at-once/constants/scoringKeybindings"

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

// 各コマンドの日本語名（新しいコマンドID形式）
export const SHORTCUT_LABELS: {
  [key in keyof typeof DEFAULT_KEYBINDINGS]: string
} = {
  // 採点
  "scoring.unscored": "未採点",
  "scoring.correct": "正答",
  "scoring.partial": "部分点",
  "scoring.pending": "保留",
  "scoring.incorrect": "誤答",
  "scoring.noAnswer": "無答",

  // ナビゲーション - 矢印キー
  "navigation.nextQuestionArrow": "次の設問（→）",
  "navigation.prevQuestionArrow": "前の設問（←）",
  "navigation.nextStudentArrow": "次の生徒（↓）",
  "navigation.prevStudentArrow": "前の生徒（↑）",

  // ナビゲーション - Shift + A/D
  "navigation.nextQuestion": "次の設問（Shift）",
  "navigation.prevQuestion": "前の設問（Shift）",

  // ナビゲーション - WASD
  "navigation.moveUp": "上に移動",
  "navigation.moveLeft": "左に移動",
  "navigation.moveDown": "下に移動",
  "navigation.moveRight": "右に移動",

  // ナビゲーション - ズーム
  "navigation.zoomIn": "拡大",
  "navigation.zoomOut": "縮小",
  "navigation.resetZoom": "ズームリセット",

  // フィルタ - Alt + 採点キー
  "filter.toggleUnscored": "未採点フィルタ",
  "filter.toggleCorrect": "正答フィルタ",
  "filter.togglePartial": "部分点フィルタ",
  "filter.togglePending": "保留フィルタ",
  "filter.toggleIncorrect": "誤答フィルタ",
  "filter.toggleNoAnswer": "無答フィルタ",

  // フィルタ - Ctrl + 数字
  "filter.toggle1": "フィルタ1",
  "filter.toggle2": "フィルタ2",
  "filter.toggle3": "フィルタ3",
  "filter.toggle4": "フィルタ4",
  "filter.toggle5": "フィルタ5",
  "filter.toggle6": "フィルタ6",

  // フィルタ - 更新
  "filter.refresh": "フィルタ更新",

  // 表示
  "view.toggleStudentNames": "名前表示切替",
  "view.toggleViewMode": "表示モード切替",
  "view.fullView": "全体表示",
  "view.questionView": "設問表示",

  // モーダル
  "modal.confirmPartial": "部分点として確定",
  "modal.confirmPending": "保留として確定",
  "modal.cancel": "キャンセル",
  "modal.backspace": "文字削除",
  "modal.input0": "0",
  "modal.input1": "1",
  "modal.input2": "2",
  "modal.input3": "3",
  "modal.input4": "4",
  "modal.input5": "5",
  "modal.input6": "6",
  "modal.input7": "7",
  "modal.input8": "8",
  "modal.input9": "9",
  "modal.inputDot": ".",

  // 保存
  "save.all": "すべて保存",
}

// カテゴリ別の設定項目（新しいコマンドID形式）
export const SHORTCUT_CATEGORIES = {
  scoring: {
    label: "採点操作",
    keys: [
      "scoring.unscored",
      "scoring.correct",
      "scoring.partial",
      "scoring.pending",
      "scoring.incorrect",
      "scoring.noAnswer",
    ] as const,
    description: "採点状態を設定するキー",
  },
  navigation: {
    label: "ナビゲーション",
    keys: [
      "navigation.nextQuestionArrow",
      "navigation.prevQuestionArrow",
      "navigation.nextStudentArrow",
      "navigation.prevStudentArrow",
      "navigation.nextQuestion",
      "navigation.prevQuestion",
      "navigation.moveUp",
      "navigation.moveLeft",
      "navigation.moveDown",
      "navigation.moveRight",
      "navigation.zoomIn",
      "navigation.zoomOut",
      "navigation.resetZoom",
    ] as const,
    description: "設問・生徒の移動、ズーム操作",
  },
  filter: {
    label: "フィルタ",
    keys: [
      "filter.toggleUnscored",
      "filter.toggleCorrect",
      "filter.togglePartial",
      "filter.togglePending",
      "filter.toggleIncorrect",
      "filter.toggleNoAnswer",
      "filter.toggle1",
      "filter.toggle2",
      "filter.toggle3",
      "filter.toggle4",
      "filter.toggle5",
      "filter.toggle6",
      "filter.refresh",
    ] as const,
    description: "フィルタの切り替え・更新",
  },
  view: {
    label: "表示制御",
    keys: [
      "view.toggleStudentNames",
      "view.toggleViewMode",
      "view.fullView",
      "view.questionView",
    ] as const,
    description: "表示の切り替え",
  },
  modal: {
    label: "モーダル操作",
    keys: [
      "modal.confirmPartial",
      "modal.confirmPending",
      "modal.cancel",
      "modal.backspace",
      "modal.input0",
      "modal.input1",
      "modal.input2",
      "modal.input3",
      "modal.input4",
      "modal.input5",
      "modal.input6",
      "modal.input7",
      "modal.input8",
      "modal.input9",
      "modal.inputDot",
    ] as const,
    description: "部分点入力モーダル内の操作",
  },
  save: {
    label: "保存",
    keys: ["save.all"] as const,
    description: "保存操作",
  },
} as const
