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

import {
  holdGradeWriteLock,
  notifyGradeWriteLocked,
} from "@/lib/gradeWriteLock"
import {
  courseworkUsingDataSources,
  examUsingDataSources,
  type UsingGradeDataSource,
} from "@/lib/shared/gradeReferenceMessages"
import { courseworkDetailQuery } from "@/queries/coursework"
import { examDetailQuery } from "@/queries/exam"

/** ロックする単位（試験1件か、試験外成績資料1件） */
type GradeLockTarget =
  | { kind: "exam"; examId: string }
  | { kind: "coursework"; courseworkId: string }

interface GradeLockContextValue {
  /** ロックしているものを言う主語（「この試験」「この資料」） */
  subject: string
  /** この試験・資料を使っているデータソース。空なら使われていない（か、まだ読み込み中） */
  dataSources: UsingGradeDataSource[]
  /** 使われていて、まだ解除していない。詳細を読み込むまでもロックしておく */
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

/** 読み込み中・使われていないときの空値（毎回新しい配列を作らない。書き換えない） */
const NO_DATA_SOURCES: UsingGradeDataSource[] = []

/** Provider の外（試験・資料の画面でないところ）ではロックしない */
const NOT_LOCKED: GradeLockContextValue = {
  subject: "",
  dataSources: NO_DATA_SOURCES,
  locked: false,
  unlock: () => undefined,
  guard: (write) => write,
}

const GradeLockContext = createContext<GradeLockContextValue>(NOT_LOCKED)

/**
 * 成績算出で使われている試験・資料を、**まるごと**ロックする。
 *
 * 試験・資料の layout に置く。使われていれば、解除するまでその試験・資料への
 * 書き込みをすべて止める（`holdGradeWriteLock` → `MutationCache`）。
 *
 * 使われているかは、layout も読む試験・資料の詳細に同梱したデータソースから導く
 * （別に問い合わせない）。詳細を読み込むまでは使われているか分からないので、
 * ロックしておく（読み込み中に書けてしまう隙間を作らない）。
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
  const { data: exam } = useQuery({
    ...examDetailQuery(target.kind === "exam" ? target.examId : ""),
    enabled: target.kind === "exam" && target.examId !== "",
  })
  const { data: coursework } = useQuery({
    ...courseworkDetailQuery(
      target.kind === "coursework" ? target.courseworkId : ""
    ),
    enabled: target.kind === "coursework" && target.courseworkId !== "",
  })
  const dataSources = useMemo(() => {
    if (target.kind === "exam") {
      return exam ? examUsingDataSources(exam) : null
    }
    return coursework ? courseworkUsingDataSources(coursework) : null
  }, [target.kind, exam, coursework])
  const [unlocked, setUnlocked] = useState(false)
  const locked = dataSources === null || (dataSources.length > 0 && !unlocked)

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

  const gradeLock = useMemo<GradeLockContextValue>(
    () => ({
      subject: target.kind === "exam" ? "この試験" : "この資料",
      dataSources: dataSources ?? NO_DATA_SOURCES,
      locked,
      unlock,
      guard,
    }),
    [target.kind, dataSources, locked, unlock, guard]
  )

  return (
    <GradeLockContext.Provider value={gradeLock}>
      {children}
    </GradeLockContext.Provider>
  )
}

/** 開いている試験・資料のロック。Provider の外ではロックしていない扱い */
export function useGradeLock(): GradeLockContextValue {
  return useContext(GradeLockContext)
}
