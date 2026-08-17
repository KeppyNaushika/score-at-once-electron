/**
 * TanStack Query のキー。
 *
 * キーは配列の前方一致で無効化されるので、`["coursework", courseworkId]` を消すと
 * その資料に紐づくものが全部消える。粗く消したいときは上位を、一点だけ消したいときは
 * 末端を指定する。
 *
 * 文字列リテラルを画面側に散らかさないため、キーは必ずここを経由して作る。
 * 同定は必ず id で行い、順序や表示名をキーに混ぜない。
 *
 * **キーは「格納する形」ごとに分ける。** 同じキーに違う形を書くと、後からマウントした
 * 画面が `isPending: false` のまま相手のデータで描画される（キャッシュは同期的に返る）。
 * 型では止まらない。`detail` は「その実体そのもの」を取る用途にだけ使い、画面が
 * まとめて1回で取る複合ペイロードには `*Page` の名前を与える。
 *
 * **使う場所ができてから足す。** 使われないキーは「そのうち要る」の形をした
 * デッドコードで、消す判断が誰にもできなくなる。
 */
export const queryKeys = {
  studentExamResults: {
    detail: (studentId: string) => ["studentExamResults", studentId] as const,
  },
  classroomExamResults: {
    detail: (classroomId: string) =>
      ["classroomExamResults", classroomId] as const,
  },
  answerSheetDefinition: {
    /**
     * 解答用紙1件に紐づくキーの前方一致。**格納しない**（無効化の範囲指定専用）。
     * 担当が変わると owner も detail も古くなるので、まとめて取り直す。
     */
    scope: (definitionId: string) =>
      ["answerSheetDefinition", definitionId] as const,
    /** 一覧（誰の解答用紙も出る。自分の分だけを見る絞り込みは表示側） */
    list: () => ["answerSheetDefinition", "list"] as const,
    /** 解答用紙定義そのもの（編集・書き出し・パンくずが共有する） */
    detail: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "detail"] as const,
    /** その解答用紙の担当者（編集できる唯一の利用者） */
    owner: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "owner"] as const,
    /** その解答用紙に紐づくタグ */
    tags: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "tags"] as const,
  },
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
