"use client"

import type { ReactNode } from "react"
import { createContext, useContext } from "react"

import type { PublicUser } from "@/queries/user"

/**
 * 関門（`AuthGate`）が絞り込んだ利用者を、そのまま子へ配る。
 *
 * `useAuth()` が返す `user` は `PublicUser | null` で、**関門が保証している
 * 「必ず居る」を型が知らない**。そのため `(app)` 配下では `userId ?? ""` という
 * 型を通すためだけの詰め物が各所に散っていた。空文字は `User.id` として存在
 * しないので、本当に渡れば FK 違反で落ちる（既定値として安全ではない）。
 *
 * **保証を作っている場所が、保証された型を配る。** 関門は `user` を確かめてから
 * ここに載せるので、`(app)` の中では `useCurrentUser()` が `PublicUser` を返す。
 */
const CurrentUserContext = createContext<PublicUser | undefined>(undefined)

export function CurrentUserProvider({
  user,
  children,
}: {
  user: PublicUser
  children: ReactNode
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  )
}

/**
 * 今ログインしている利用者。**`null` を含まない。**
 *
 * 関門の外（`login/` など）で呼べば例外を投げる。型で守れない範囲外の使用を、
 * 実行時に即座に分かる形で落とすため。ログイン前も描かれる場所では
 * `useAuth()` を使うこと。
 */
export function useCurrentUser(): PublicUser {
  const user = useContext(CurrentUserContext)
  if (user === undefined) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider")
  }
  return user
}
