"use client"

import type { User } from "@prisma/client"
import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queryKeys"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: User[] = []

/**
 * 利用者の一覧。
 *
 * ログイン画面・監査ログの絞り込み・担当の受け渡し先の選択が同じものを見るので、
 * 画面ごとに取り直さず1つのキャッシュを共有する。
 */
export function useUsers() {
  const { data: users = EMPTY_USERS, isPending } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => window.electronAPI.fetchUsers(),
  })

  return { users, isPending }
}
