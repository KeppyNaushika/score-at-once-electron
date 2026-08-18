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
   * 取り違えを避けるため、コンポーネントの実体（`useId`）で必ず区切る。
   */
  roster: {
    table: (instanceId: string) => ["roster", instanceId, "table"] as const,
    availableClassrooms: (instanceId: string) =>
      ["roster", instanceId, "availableClassrooms"] as const,
    addPanelClassrooms: (instanceId: string, activeOnly: boolean) =>
      ["roster", instanceId, "addPanelClassrooms", activeOnly] as const,
    addPanelStudents: (instanceId: string, activeOnly: boolean) =>
      ["roster", instanceId, "addPanelStudents", activeOnly] as const,
  },
} as const
