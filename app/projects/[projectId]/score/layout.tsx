"use client"

import React from "react"
import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

// 採点ステップの定義
const scoringSteps = [
  { id: "master-image", label: "1. 模範解答", hrefSuffix: "" }, // 初期ステップは /score 直下
  { id: "template", label: "2. 採点テンプレート", hrefSuffix: "/template" },
  { id: "upload", label: "3. 解答用紙", hrefSuffix: "/upload" },
  { id: "scoring", label: "4. 採点", hrefSuffix: "/scoring" },
  { id: "results", label: "5. 結果", hrefSuffix: "/results" },
]

export default function ScoringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const projectId = params.projectId as string

  // TODO: 試験の進捗状況に応じてステップの有効/無効を管理するロジック
  // 例えば、APIから進捗を取得し、完了済みのステップや現在のステップを特定する
  const completedStepIds = ["master-image"] // 仮の完了済みステップ
  const currentActualStepId = "template" // 仮の現在の実際の進捗ステップ

  const getStepStatus = (
    stepId: string,
    index: number,
  ): { isCompleted: boolean; isDisabled: boolean; isCurrentPage: boolean } => {
    const currentPathSuffix = pathname.replace(
      `/projects/${projectId}/score`,
      "",
    )
    const isCurrentPage = currentPathSuffix === scoringSteps[index].hrefSuffix

    // 実際の進捗に基づいて判断
    const actualCurrentIndex = scoringSteps.findIndex(
      (s) => s.id === currentActualStepId,
    )
    const isCompleted = completedStepIds.includes(stepId)
    // isDisabled: 現在の実際の進捗より未来のステップで、かつ完了していないステップは無効
    const isDisabled = index > actualCurrentIndex && !isCompleted

    return { isCompleted, isDisabled, isCurrentPage }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background border-b p-4">
        <Breadcrumb>
          <BreadcrumbList>
            {scoringSteps.map((step, index) => {
              const { isCompleted, isDisabled, isCurrentPage } = getStepStatus(
                step.id,
                index,
              )
              const linkHref = `/projects/${projectId}/score${step.hrefSuffix}`

              return (
                <React.Fragment key={step.id}>
                  <BreadcrumbItem>
                    {isCurrentPage ? (
                      <BreadcrumbPage>{step.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        asChild={!isDisabled} // 無効でない場合のみ Link を使用
                        className={cn(
                          isDisabled &&
                            "text-muted-foreground cursor-not-allowed",
                          isCompleted &&
                            !isCurrentPage &&
                            "text-green-600 hover:text-green-700",
                        )}
                      >
                        {isDisabled ? (
                          <span>{step.label}</span>
                        ) : (
                          <Link href={linkHref}>{step.label}</Link>
                        )}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < scoringSteps.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <main className="flex-grow overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
