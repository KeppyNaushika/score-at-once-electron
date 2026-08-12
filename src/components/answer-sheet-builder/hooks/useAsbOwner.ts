"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/contexts/AuthContext"
import { queryKeys } from "@/lib/queryKeys"

/**
 * 解答用紙の担当者。
 *
 * 編集・削除ができるのは担当者ひとりだけで、他の利用者は閲覧と書き出しだけができる。
 * 直したい人は担当を渡してもらう（同時に編集できる形にしない）。
 */
export function useAsbOwner(definitionId: string) {
  const { user } = useAuth()
  const { data: owner = null, isPending } = useQuery({
    queryKey: queryKeys.answerSheetDefinition.owner(definitionId),
    queryFn: () => window.electronAPI.answerSheetBuilder.getOwner(definitionId),
  })

  return {
    ownerId: owner?.ownerId ?? null,
    ownerName: owner?.ownerName ?? null,
    /** 判定できるまでは false（読み込み中に編集させない） */
    isOwner: owner !== null && owner.ownerId === user?.id,
    isPending,
  }
}
