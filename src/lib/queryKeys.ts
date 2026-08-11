/**
 * TanStack Query のキー。
 *
 * キーは配列の前方一致で無効化されるので、`["userPreference", userId]` を消すと
 * その利用者の設定が全部消える。粗く消したいときは上位を、一点だけ消したいときは
 * 末端を指定する。
 *
 * 文字列リテラルを画面側に散らかさないため、キーは必ずここを経由して作る。
 * 同定は必ず id で行い、順序や表示名をキーに混ぜない。
 */
export const queryKeys = {
  userPreference: {
    all: ["userPreference"] as const,
    detail: (userId: string | undefined, key: string) =>
      ["userPreference", userId, key] as const,
  },
  keyboardShortcut: {
    detail: (userId: string | undefined) =>
      ["keyboardShortcut", userId] as const,
  },
  examExportSettings: {
    detail: (examId: string) => ["examExportSettings", examId] as const,
  },
  projectorMode: {
    all: ["projectorMode"] as const,
  },
  fullScreen: {
    all: ["fullScreen"] as const,
  },
} as const
