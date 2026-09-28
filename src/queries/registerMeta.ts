/**
 * 空でないキー。
 *
 * TanStack の照合は前方一致で（`query-core/utils.ts` の `partialMatchKey` が
 * 渡した配列の要素数だけ回る）、`[]` は**すべてのクエリに当たる**。書き出しボタン
 * 1つでキャッシュ全体が無効化される、という形で静かに壊れるので、型で塞ぐ。
 */
type NonEmptyQueryKey = readonly [unknown, ...unknown[]]

/**
 * 取り直す行き先。**1つ以上**。
 *
 * 1つの操作が2つの行き先に効くことがある（データソースを足すと、成績本体も
 * 相関の算出も古くなる）。前方一致の1本にまとめようとすると、無関係で重い
 * クエリまで巻き込むか、逆に取り残すかのどちらかになる。
 */
export type InvalidationTargets = readonly [
  NonEmptyQueryKey,
  ...NonEmptyQueryKey[],
]

/**
 * 書き込みが持つ宣言。**DB を書くかどうかで形が違う。**
 *
 * DB を書くなら、取り直す先の申告が要る。書かないなら、取り直す先は存在しない。
 * この2つを1つの形にまとめると「書くのに申告し忘れた」が表現できてしまうので、
 * 判別ユニオンにして**どちらかを必ず名乗らせる**。
 *
 * `errorMessage` は失敗トーストの見出し。文言は画面ごとに違うが、出す処理は
 * `QueryProvider` の `MutationCache` に1つだけある。各書き込みは宣言を持ち、
 * 実装を持たない。
 */
export type AppMutationMeta =
  | {
      /** 成功・失敗いずれでも取り直す行き先（前方一致）。1つ以上 */
      invalidates: InvalidationTargets
      writesDatabase?: never
      /** 失敗トーストの見出し */
      errorMessage: string
      /**
       * **成績算出のロック中でも止めない**と名乗る（`src/lib/gradeWriteLock.ts`）。
       *
       * 既定では、成績算出で使われている試験・資料を開いている間、DB を書く
       * 書き込みはすべて止まる。試験・資料の中身を変えないもの（利用者の設定・
       * 出力設定・同期・監査ログだけを書くもの）だけがこれを付ける。点数・配点・
       * 受験者・答案などに1行でも触れるなら付けない
       */
      bypassesGradeLock?: true
    }
  | {
      /**
       * **DB を書かないと名乗る。** Excel 出力・PDF 印刷・ファイル選択ダイアログ・
       * 検証のように、読み直す対象を持たない経路だけがこちらを使う。
       *
       * 1行でも DB に書くならこちらではない。取り直さないので、書いた結果が
       * 画面に出てこない。
       */
      writesDatabase: false
      invalidates?: never
      /** DB を書かないので、成績算出のロックはもともと掛からない */
      bypassesGradeLock?: never

      /** 失敗トーストの見出し */
      errorMessage: string
    }

/** TanStack Query の `meta` に型を入れる。 */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: AppMutationMeta
  }
}
