/**
 * 差し込み式の名簿UIだけが使うキー。
 *
 * **実体の読み書きのキーはここに無い。** それらは `src/queries/` の
 * `queryOptions` がキーと `queryFn` を1箇所で持つ（段階14 で移し終えた）。
 * ここに残っているのは、中身をアダプタが決めるせいで「何の名簿か」が呼び出し側に
 * しか分からない汎用UIのぶんだけ。
 *
 * キーは配列の前方一致で無効化される。同定は必ず id（またはコンポーネントの実体）で
 * 行い、順序や表示名をキーに混ぜない。
 */
export const queryKeys = {
  /**
   * 汎用の名簿UI（RosterTable / StudentAddPanel / ClassroomRosterManager）。
   *
   * 中身は差し込まれた adapter が決めるので、何の名簿かはキーからは分からない。
   * **持ち主の id（成績id・試験id・資料id）で区切る。** 以前はコンポーネントの実体
   * （`useId`）で区切っていたが、それは木の中の位置でしかなく、別の成績の同じ画面へ
   * 移ると同じキーになって前の名簿の行が出た（並べ替えると、その行の id が新しい方の
   * 書き込みへ渡る）。
   */
  roster: {
    table: (scopeId: string) => ["roster", scopeId, "table"] as const,
    availableClassrooms: (scopeId: string) =>
      ["roster", scopeId, "availableClassrooms"] as const,
    addPanelClassrooms: (scopeId: string, activeOnly: boolean) =>
      ["roster", scopeId, "addPanelClassrooms", activeOnly] as const,
    addPanelStudents: (scopeId: string, activeOnly: boolean) =>
      ["roster", scopeId, "addPanelStudents", activeOnly] as const,
  },
} as const
