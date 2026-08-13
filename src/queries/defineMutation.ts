import type { MutationMeta, MutationOptions } from "@tanstack/react-query"

/**
 * 書き込みの定義はこれを通す。**`mutationOptions` を直接使わない。**
 *
 * TanStack の `meta` は optional なので、型注入（`registerMeta.ts`）では必須にできない。
 * ここで required にすることで、「何を取り直すか」「失敗したら何と言うか」の書き忘れを
 * コンパイルエラーにする。
 *
 * `useMutation` にはこの関数の戻り値だけを渡す（オブジェクトを直接書かない）。
 * そうしないと `meta` の無い書き込みが作れてしまう。
 */
export function defineMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: Omit<
    MutationOptions<TData, TError, TVariables, TContext>,
    "meta"
  > & { meta: MutationMeta }
): MutationOptions<TData, TError, TVariables, TContext> & {
  meta: MutationMeta
} {
  return options
}
