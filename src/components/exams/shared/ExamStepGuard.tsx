"use client"

import { Lock } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { GuardedLink } from "@/components/common/GuardedLink"
import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { EXAM_ROLE_LABELS, type ExamRole } from "@/lib/shared/examRoles"
import { examWorkflowTabs } from "@/lib/workflowTabs"

interface ExamStepGuardProps {
  examId: string
  /** 参加者の取得が済んでいないか */
  isPending: boolean
  /** 自分のロール。参加者でなければ null（絞らない） */
  role: ExamRole | null
  /** 入れる段 */
  allowedTabs: readonly WorkflowTab[]
  children: ReactNode
}

/**
 * 入れない段を開いたときに、中身の代わりに理由と行き先を出す
 * （docs/scoring-scope-and-permissions-design.md §3-3・§6「リンクを隠すだけでは足りない」）。
 *
 * タブから外しても、URL を直に開く・履歴で戻る・概要のリンクから来ることはできるので、
 * 段そのものをここで止める。これは権限境界ではない（§2-4）。誤って準備の段を触らない
 * ための導線である。
 */
export function ExamStepGuard({
  examId,
  isPending,
  role,
  allowedTabs,
  children,
}: ExamStepGuardProps) {
  const pathname = usePathname()

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  const entityHref = `/exams/${examId}`
  const currentTab = examWorkflowTabs.find(
    (tab) => pathname === entityHref + tab.path
  )
  const isAllowed =
    role === null ||
    currentTab === undefined ||
    allowedTabs.some((tab) => tab.id === currentTab.id)
  if (isAllowed) return <>{children}</>

  // 行き先は入れる段のうち、概要を除いた最初のもの（採点者なら採点、閲覧者なら結果）
  const destination =
    allowedTabs.find((tab) => tab.path !== "") ?? allowedTabs[0]

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">
        「{currentTab.title}」は、この試験のオーナーが使う段です
      </p>
      <p className="text-sm text-muted-foreground">
        あなたはこの試験の{EXAM_ROLE_LABELS[role]}です。
        {role === "EDITOR"
          ? "採点と、許可されていれば結果出力を使えます。"
          : "結果出力を使えます。"}
        ほかの段を使うには、オーナーに役割を変えてもらってください。
      </p>
      {destination && (
        <Button asChild>
          <GuardedLink href={entityHref + destination.path}>
            「{destination.title}」へ
          </GuardedLink>
        </Button>
      )}
    </div>
  )
}
