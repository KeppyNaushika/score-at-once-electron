import type { QueryKey } from "@tanstack/react-query"

/**
 * TanStack Query の `meta` に型を入れる。
 *
 * **書き込みは必ず「何を取り直すか」を申告する。** `invalidates` を必須にしてあるので、
 * 書き忘れるとコンパイルエラーになる。無効化の実装は `QueryProvider` の `MutationCache`
 * に1つだけあり、各書き込みは実装ではなく宣言を持つ。
 *
 * `errorMessage` は失敗トーストの見出し。文言は画面ごとに違うが、出す処理は1箇所。
 */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** 成功・失敗いずれでも取り直すキー（前方一致） */
      invalidates: QueryKey
      /** 失敗トーストの見出し */
      errorMessage: string
    }
  }
}
