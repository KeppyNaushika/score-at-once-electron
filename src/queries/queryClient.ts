import "./registerMeta"

import { MutationCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

/**
 * アプリで使う QueryClient を作る。
 *
 * **書き込みの後始末はここに1つだけ置く。** 各書き込みは `meta` で「何を取り直すか」と
 * 「失敗したら何と言うか」を宣言し、実装は持たない。各所に散っていた try/catch と
 * invalidate の書き忘れを、宣言（`defineMutation` が `meta` を必須にする）で止める形。
 *
 * 取得の既定:
 * - 再試行しない。IPC はネットワークを跨がないので、繰り返しても結果は変わらない
 * - 窓に戻るたびの再取得を止める。NAS同期で他の教員の変更は入るが、採点中に
 *   手元の表示が動くほうが害が大きい。拾いたい画面はその `useQuery` で有効にする
 */
export function createAppQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
    mutationCache: new MutationCache({
      // 成功しても失敗しても DB から取り直す。失敗したときこそ、手元の表示を
      // DB に揃える必要がある（書けなかった値を保存済みとして見せない）。
      //
      // meta は `defineMutation` が必須にしているのでここへ来る書き込みは必ず持つが、
      // 型の上では optional なので、素の `useMutation` を書かれても落ちないようにする
      onSettled: (_data, _error, _variables, _context, mutation) => {
        if (!mutation.meta) return
        // 連打をまとめる。同じ行き先へ書いているものが他にも走っている間は
        // 取り直さず、最後の1つだけが取り直す。これが無いと、10マス切り替えれば
        // 取り直しも10回走る（実測）。
        //
        // `mutationKey` は `defineMutation` が `meta.invalidates` から付ける。
        // `isMutating` は自分を含めて数えるので、1 なら自分だけ
        const stillWriting = client.isMutating({
          mutationKey: mutation.options.mutationKey,
        })
        if (stillWriting > 1) return
        void client.invalidateQueries({ queryKey: mutation.meta.invalidates })
      },
      onError: (error, _variables, _context, mutation) => {
        toast.error(mutation.meta?.errorMessage ?? "保存できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
      },
    }),
  })
  return client
}
