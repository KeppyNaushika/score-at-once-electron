/**
 * 消す前に数え直して中止する、削除の共通の作法（docs/remaining-work.md 段階26）。
 *
 * 削除の確認は「消すと何を巻き添えにするか」を数えて見せる。**数え終わってから
 * 利用者が押すまでの間に、他の教員が書き足す窓**がある。そこで見せた件数を削除の
 * 要求に添えてもらい、消す直前に同じ定義で数え直し、増えていれば削除を中止する。
 *
 * **窓は縮むが消えない。** 数え直しから削除までは同じトランザクションに入るので
 * その間に割り込まれることは無いが、**利用者が見た瞬間から数え直しまでの間**は
 * 依然として空いている。他の教員がそこで書き足したぶんは数え直しが拾うので削除は
 * 中止されるが、「見せた件数がその瞬間に正しかった」ことを保証する仕組みではない。
 * これを本当に閉じるには DB 側の直列化が要る（SQLite を共有フォルダに置く前提では
 * 取れない）。ここで保証するのは**「見せた後に増えたものを黙って消さない」**だけ。
 *
 * **数える定義は、見せたものと揃えること。** 削除が実際に消す行数と、利用者に見せた
 * 件数は一致しない（答案の削除は `unscored` の初期化行も消すが、見せているのは
 * 「採点実績」）。比べるのは常に**利用者から見た件数**であって、消える行数ではない。
 *
 * 各削除に同じ確認を書き写すと必ずどれかで抜けるので、作法はここ1箇所に置く
 * （`asbDefinitionWrite.ts` の書き込みの関所と同じ考え方）。
 */

import type { Prisma } from "@prisma/client"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import prisma from "./client"

interface DeleteAfterRecountOptions<TDeleteResult> {
  /**
   * 利用者が確認ダイアログで見た件数。削除の要求に添えて renderer から渡ってくる。
   * 見せていない項目は含めない（含めないものは「0件と見せた」ものとして扱われる）。
   */
  confirmedCounts: ConfirmedDeletionCount[]
  /**
   * 消す直前に数え直す。**利用者に見せたときと同じ定義で数えること。**
   * 削除しても何も巻き添えにしない選択肢（登録解除だけ、など）では空配列を返す。
   */
  recount: (tx: Prisma.TransactionClient) => Promise<ConfirmedDeletionCount[]>
  /** 数え直しが見せた件数を超えなかったときだけ呼ばれる、削除の本体 */
  remove: (tx: Prisma.TransactionClient) => Promise<TDeleteResult>
  /** 対象が多く既定の 5s を超える削除で伸ばす（超えると P2028 で巻き戻る） */
  timeoutMs?: number
}

/** 見せた件数と数え直した件数が食い違った1項目 */
interface RecountDifference {
  countedName: string
  shownCount: number
  currentCount: number
}

/**
 * 見せた件数より増えたものを拾う。
 *
 * **減ったものは中止しない。** 減っているのは他の教員が先に消した場合で、利用者が
 * 承知した巻き添えより実際に消えるものが少ないだけなので、意図に反しない。塞ぎたい
 * のは「無い」と見せた後に**書き足された**ものを黙って消す側だけである。
 */
function findIncreasedCounts(
  confirmedCounts: ConfirmedDeletionCount[],
  currentCounts: ConfirmedDeletionCount[]
): RecountDifference[] {
  return currentCounts.flatMap((currentCount) => {
    const confirmed = confirmedCounts.find(
      (confirmedCount) =>
        confirmedCount.countedName === currentCount.countedName
    )
    // 見せていない項目は「0件と見せた」扱い。数え直しに出てきた時点で増えている
    const shownCount = confirmed?.shownCount ?? 0
    if (currentCount.shownCount <= shownCount) return []
    return [
      {
        countedName: currentCount.countedName,
        shownCount,
        currentCount: currentCount.shownCount,
      },
    ]
  })
}

/** 中止したことを利用者へ伝える文言を組み立てる */
function buildRefusalMessage(differences: RecountDifference[]): string {
  const details = differences
    .map(
      (difference) =>
        `${difference.countedName} ${difference.shownCount}件 → ${difference.currentCount}件`
    )
    .join("、")
  return `確認したあとに他の教員が書き足したため、削除を中止しました（${details}）。もう一度確認してください。`
}

/**
 * 消す前に数え直し、増えていたら中止する。
 *
 * 数え直しと削除は同じトランザクションで行う（別々にすると、その間にもう一度
 * 窓が開く）。中止は例外で伝える — 削除しなかったことを値で返すと、呼び出し側が
 * 見落としてもコンパイルが通る（docs/coding-style.md「IPC の失敗の伝え方」）。
 */
export async function deleteAfterRecount<TDeleteResult>({
  confirmedCounts,
  recount,
  remove,
  timeoutMs,
}: DeleteAfterRecountOptions<TDeleteResult>): Promise<TDeleteResult> {
  return await prisma.$transaction(
    async (tx) => {
      const currentCounts = await recount(tx)
      const differences = findIncreasedCounts(confirmedCounts, currentCounts)
      if (differences.length > 0) {
        throw new Error(buildRefusalMessage(differences))
      }
      return await remove(tx)
    },
    timeoutMs === undefined ? undefined : { timeout: timeoutMs }
  )
}
