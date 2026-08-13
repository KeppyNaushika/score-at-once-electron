import type { MutationOptions } from "@tanstack/react-query"

import type { AppMutationMeta } from "./registerMeta"

/**
 * 書き込みの定義はこれを通す。**`mutationOptions` を直接使わない。**
 *
 * TanStack の `meta` は optional なので、型注入（`registerMeta.ts`）では必須にできない。
 * ここで required にすることで、宣言の書き忘れをコンパイルエラーにする。
 *
 * `meta` は判別ユニオン（`AppMutationMeta`）なので、**DB を書くなら
 * `invalidates` が必須**で、書かないなら `writesDatabase: false` を名乗る。
 * どちらも書かない、という状態は型で作れない。
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
    "meta" | "mutationKey"
  > & { meta: AppMutationMeta }
): MutationOptions<TData, TError, TVariables, TContext> & {
  meta: AppMutationMeta
} {
  return {
    // 取り直す行き先の一覧をそのまま `mutationKey` にも置く。連打をまとめるとき、
    // 「同じ行き先へ書いているものが他に走っているか」を `isMutating` の
    // 標準の絞り込みで判定できる（キーの比較はライブラリの hashKey が行う）。
    //
    // DB を書かない経路（出力・ダイアログ）は `mutationKey` も持たない。
    // まとめる対象が無いので不要であり、`undefined` を置くと `isMutating` の
    // 絞り込みが全件に当たってしまう。
    ...(options.meta.invalidates
      ? { mutationKey: options.meta.invalidates }
      : {}),
    ...options,
  }
}
