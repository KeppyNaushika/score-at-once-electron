"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  canEnterExamStep,
  type ExamRole,
  parseExamRole,
} from "@/lib/shared/examRoles"
import { examWorkflowPhases, examWorkflowTabs } from "@/lib/workflowTabs"
import { examMembersQuery } from "@/queries/userExam"

/**
 * 今の利用者がこの試験で入れる段（docs/scoring-scope-and-permissions-design.md §3-3）。
 *
 * 参加者の取得（`examMembersQuery`）から自分の行を引いて決める。ロールや結果出力の許可を
 * 変えると参加者が取り直されるので、別の取得を持たない。
 *
 * **参加者でない試験では絞らない。** 一覧は参加している試験しか出さないので、ここへ来るのは
 * id を直に開いたときか、参加の行を持たない古いデータだけ。これは権限境界ではない（§2-4）
 * ので、止めずに今までどおり全部を見せる。
 */
export function useExamAccess(examId: string) {
  const currentUser = useCurrentUser()
  const { data: members, isPending } = useQuery({
    ...examMembersQuery(examId),
    enabled: Boolean(examId),
  })

  const member = useMemo(() => {
    const userExam = members?.find(
      (examMember) => examMember.userId === currentUser.id
    )
    const role = userExam ? parseExamRole(userExam.role) : null
    return userExam && role
      ? { role, canExportResults: userExam.canExportResults }
      : null
  }, [members, currentUser.id])

  /** 入れる段だけのタブ（ヘッダーのタブと「次へ」、概要の段カードが使う） */
  const tabs = useMemo(
    () =>
      member === null
        ? examWorkflowTabs
        : examWorkflowTabs.filter((tab) => canEnterExamStep(member, tab.id)),
    [member]
  )

  /** 入れる段が1つも無いまとまりは出さない（空の箱が並ぶだけになる） */
  const phases = useMemo(
    () =>
      examWorkflowPhases
        .map((phase) => ({
          ...phase,
          stepIds: phase.stepIds.filter((stepId) =>
            tabs.some((tab) => tab.id === stepId)
          ),
        }))
        .filter((phase) => phase.stepIds.length > 0),
    [tabs]
  )

  const role: ExamRole | null = member?.role ?? null

  return {
    /** 参加者の取得が済んでいないあいだは true（段を出し分ける前にちらつかせない） */
    isPending: Boolean(examId) && isPending,
    /** 自分のロール。参加者でなければ null */
    role,
    /** 試験の構成を変えられるか（オーナー、または参加者でない古いデータ） */
    canManageExam: role === null || role === "OWNER",
    tabs,
    phases,
  }
}
