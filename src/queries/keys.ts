/**
 * キーの前方一致で使う「まとまり」だけを置く。
 *
 * **個々のキーはここに書かない。** `queryOptions` がキーと `queryFn` を1箇所で結びつける
 * ので、キーの一覧を別に持つと二重管理になる（同じデータが別のキーで2度キャッシュされる
 * 事故は、そこから起きた）。
 *
 * ここにあるのは「この試験に紐づくもの全部を取り直す」のように、**複数のクエリを
 * まとめて指す前方一致**だけ。各クエリはこの接頭辞から自分のキーを組み立てる。
 *
 * TanStack のキーは配列の前方一致で照合される。`["exam", examId]` を無効化すると
 * `["exam", examId, "detail"]` も `["exam", examId, "scoringPage"]` も対象になる。
 */
export const scopeKeys = {
  /** 試験1件に紐づくもの全部 */
  exam: (examId: string) => ["exam", examId] as const,
  /** 成績算出1件に紐づくもの全部 */
  grade: (gradeId: string) => ["grade", gradeId] as const,
  /** 試験外成績資料1件に紐づくもの全部 */
  coursework: (courseworkId: string) => ["coursework", courseworkId] as const,
  /** 解答用紙1件に紐づくもの全部 */
  answerSheetDefinition: (definitionId: string) =>
    ["answerSheetDefinition", definitionId] as const,
  /**
   * 手書き注釈の全部。
   *
   * 注釈は取り出し方が4通りある（設問スコア別・受験者別・設問別・試験の一覧）。
   * 1件書けばそのどれもが古くなるうえ、削除は id しか受け取らないので
   * 「どの取り出し方が当たるか」を書き込み側から絞れない。まとめて取り直す。
   */
  annotation: () => ["annotation"] as const,
} as const
