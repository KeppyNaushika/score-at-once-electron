"use client"

import { ArrowLeft } from "lucide-react"
import { useParams, usePathname } from "next/navigation"
import React, { useEffect, useState } from "react"

import { GuardedLink } from "@/components/common/GuardedLink"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const workflowSteps = [
  { id: "detail", label: "概要", path: "" },
  { id: "edit", label: "1. 作成", path: "/01-edit" },
  { id: "export", label: "2. 書き出し", path: "/02-export" },
]

/**
 * 解答用紙作成の個別定義レイアウト。
 * 概要 / 1. 作成 / 2. 書き出し の3ページをパンくずタブで束ねる。
 */
export default function AnswerSheetBuilderDefinitionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ definitionId: string }>()
  const definitionId = params.definitionId
  const pathname = usePathname()
  const [definitionName, setDefinitionName] = useState("")

  useEffect(() => {
    const load = async () => {
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) return
      const result = await api.loadDefinition(definitionId)
      if (result.success && result.data) {
        setDefinitionName(result.data.name)
      }
    }
    void load()
  }, [definitionId])

  const base = `/answer-sheet-builder/${definitionId}`

  return (
    <div className="flex h-screen flex-col">
      <header className="shrink-0 border-b">
        <div className="flex items-center justify-between gap-4 px-4 pt-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <GuardedLink href="/answer-sheet-builder">
                    解答用紙作成
                  </GuardedLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{definitionName || "解答用紙"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button variant="ghost" size="sm" asChild>
            <GuardedLink href="/answer-sheet-builder">
              <ArrowLeft className="mr-1 h-4 w-4" />
              一覧へ戻る
            </GuardedLink>
          </Button>
        </div>
        <nav className="flex gap-1 px-4 pt-1">
          {workflowSteps.map((step) => {
            const isCurrent = pathname === base + step.path
            return (
              <GuardedLink
                key={step.id}
                href={base + step.path}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  isCurrent
                    ? "border-green-600 font-semibold text-green-600"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                )}
              >
                {step.label}
              </GuardedLink>
            )
          })}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
