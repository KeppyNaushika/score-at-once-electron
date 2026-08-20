"use client"

import { useCallback, useState } from "react"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

/**
 * 「見せた件数を添えて削除し、中止されたら数え直す」削除確認の共通の形
 * （docs/remaining-work.md 段階26）。
 *
 * 削除の確認は「消すと何を巻き添えにするか」を数えて見せる。数え終わってから
 * 利用者が押すまでの間に他の教員が書き足すと、見せた件数は嘘になる。そこで
 * **見せた件数をそのまま削除の要求に添え**、main が消す直前に数え直して増えていれば
 * 中止する（`electron-src/lib/prisma/deleteAfterRecount.ts`）。
 *
 * 中止されたら**ダイアログは閉じない**。文言を出し、その場で数え直した結果を
 * 見せて、利用者にもう一度決めてもらう。
 */
interface UseConfirmedDeletionOptions {
  /**
   * いま利用者に見せている件数。**表示に使っている配列をそのまま渡すこと**
   * （見せたものと送るものが同じ配列なら食い違いようがない）。
   * まだ数え終わっていない間は `null` にする — その間は押させない。
   */
  confirmedCounts: ConfirmedDeletionCount[] | null
  /** 見せた件数を添えて削除する */
  deleteWithConfirmedCounts: (
    confirmedCounts: ConfirmedDeletionCount[]
  ) => Promise<void>
  /**
   * 数え直す。中止されたときに呼ばれ、新しい件数が `confirmedCounts` へ入る。
   *
   * 中止以外の失敗でも呼ぶ。失敗の理由を文言で見分けようとすると文言の変更で
   * 壊れるうえ、数え直しは何度やっても害が無い（安全側に倒す）。
   */
  recount: () => Promise<unknown>
}

export function useConfirmedDeletion({
  confirmedCounts,
  deleteWithConfirmedCounts,
  recount,
}: UseConfirmedDeletionOptions) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [refusalMessage, setRefusalMessage] = useState<string | null>(null)

  /** 確認ボタンから呼ぶ。削除できたら true（呼び出し側はそのとき閉じる） */
  const confirmDeletion = useCallback(async (): Promise<boolean> => {
    if (confirmedCounts === null || isDeleting) return false
    setIsDeleting(true)
    setRefusalMessage(null)
    try {
      await deleteWithConfirmedCounts(confirmedCounts)
      return true
    } catch (error) {
      setRefusalMessage(
        error instanceof Error && error.message
          ? error.message
          : "削除できませんでした。もう一度確認してください。"
      )
      // 数え直しの失敗はここでは何もできない（中止の文言は既に出ている）
      await recount().catch(() => {})
      return false
    } finally {
      setIsDeleting(false)
    }
  }, [confirmedCounts, deleteWithConfirmedCounts, isDeleting, recount])

  return {
    /** 数え終わっていて、削除中でもないか */
    canConfirm: confirmedCounts !== null && !isDeleting,
    isDeleting,
    /** 中止されたときに出す文言。null なら中止されていない */
    refusalMessage,
    confirmDeletion,
  }
}
