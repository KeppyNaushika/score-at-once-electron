export const KEYBOARD_SHORTCUTS = {
  SCORING: {
    UNSCORED: { key: "Q", label: "未採点" },
    CORRECT: { key: "E", label: "正答" },
    PARTIAL: { key: "F", label: "部分点" },
    PENDING: { key: "J", label: "保留" },
    INCORRECT: { key: "O", label: "誤答" },
    NO_ANSWER: { key: "P", label: "無答" },
  },
  NAVIGATION: {
    PREV_QUESTION: { key: "Shift+A", label: "前の設問" },
    NEXT_QUESTION: { key: "Shift+D", label: "次の設問" },
    GRID_MOVEMENT: { key: "WASD", label: "WASD移動" },
    REFRESH_FILTER: { key: "R", label: "フィルタ更新" },
    TOGGLE_FILTER: { key: "採点キー", label: "フィルタ切替" },
    PARTIAL_INPUT: { key: "0-9,.", label: "部分点入力" },
    PARTIAL_RESET: { key: "Backspace", label: "部分点リセット" },
    FILTER_TOGGLE_NUMBERS: { key: "Ctrl+1-6", label: "フィルタ切替(数字)" },
  },
} as const

export const DEFAULT_GRID_SIZE = { columns: 4, rows: 3 } as const

export const DEFAULT_LAYOUT_DIRECTION = "right-down" as const

export const DEFAULT_EFFECTIVE_COLUMNS = 5 as const