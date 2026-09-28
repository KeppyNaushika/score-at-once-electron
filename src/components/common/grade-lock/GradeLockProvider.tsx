"use client"

import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { NO_GRADE_LOCK_SOURCES } from "@/lib/gradeLock"
import {
  holdGradeWriteLock,
  notifyGradeWriteLocked,
} from "@/lib/gradeWriteLock"
import { gradeLockSourcesQuery } from "@/queries/grade"
import type { GradeLockSource, GradeLockTarget } from "@/types/gradeLock.types"

interface GradeLockContextValue {
  /** ロックしているものを言う主語（「この試験」「この資料」） */
  subject: string
  /** この試験・資料を使っているデータソース。空なら使われていない */
  sources: GradeLockSource[]
  /** 使われていて、まだ解除していない */
  locked: boolean
  /** 確認のうえで解除する（この試験・資料を出るまで続く） */
  unlock: () => void
  /**
   * 書き込みの口を包む。ロック中は何もせず通知だけ出す。
   *
   * 書き込みそのものは `MutationCache` が止めるので、これは書き込みの前後にある
   * 画面の動き（採点後の自動進行・部分点のモーダルを開くなど）まで止めたいところで使う
   */
  guard: <Args extends unknown[]>(
    write: (...args: Args) => void
  ) => (...args: Args) => void
}

/** Provider の外（試験・資料の画面でないところ）ではロックしない */
const NOT_LOCKED: GradeLockContextValue = {
  subject: "",
  sources: NO_GRADE_LOCK_SOURCES,
  locked: false,
  unlock: () => undefined,
  guard: (write) => write,
}

const GradeLockContext = createContext<GradeLockContextValue>(NOT_LOCKED)

const targetId = (target: GradeLockTarget) =>
  target.kind === "exam" ? target.examId : target.courseworkId

/**
 * 成績算出で使われている試験・資料を、**まるごと**ロックする。
 *
 * 試験・資料の layout に置く。使われていれば、解除するまでその試験・資料への
 * 書き込みをすべて止める（`holdGradeWriteLock` → `MutationCache`）。
 *
 * **解除は state だけで持つ。** layout はタブを移っても作り直されないので、解除は
 * その試験・資料の中にいる間どのタブでも続き、出れば（layout ごと外れれば）再び
 * ロックされる。別の試験へ直接移ったときも作り直すよう、呼び出し側は `key` に
 * 試験・資料の id を渡すこと。DB にも localStorage にも書かない。
 */
export function GradeLockProvider({
  target,
  children,
}: {
  target: GradeLockTarget
  children: ReactNode
}) {
  const { data: sources = NO_GRADE_LOCK_SOURCES } = useQuery({
    ...gradeLockSourcesQuery(target),
    enabled: targetId(target) !== "",
  })
  const [unlocked, setUnlocked] = useState(false)
  const locked = sources.length > 0 && !unlocked

  // ロック中だけ握る。解除する・layout を出ると手放す
  useEffect(() => {
    if (!locked) return
    return holdGradeWriteLock()
  }, [locked])

  const unlock = useCallback(() => setUnlocked(true), [])

  const guard = useCallback(
    <Args extends unknown[]>(write: (...args: Args) => void) =>
      (...args: Args): void => {
        if (locked) {
          notifyGradeWriteLocked()
          return
        }
        write(...args)
      },
    [locked]
  )

  const value = useMemo<GradeLockContextValue>(
    () => ({
      subject: target.kind === "exam" ? "この試験" : "この資料",
      sources,
      locked,
      unlock,
      guard,
    }),
    [target.kind, sources, locked, unlock, guard]
  )

  return (
    <GradeLockContext.Provider value={value}>
      {children}
    </GradeLockContext.Provider>
  )
}

/** 開いている試験・資料のロック。Provider の外ではロックしていない扱い */
export function useGradeLock(): GradeLockContextValue {
  return useContext(GradeLockContext)
}
