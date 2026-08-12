"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import React from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/queryKeys"

const workflowSteps = [
  { id: "02-students", label: "1. 生徒管理", path: "02-students" },
  { id: "03-data-sources", label: "2. データソース", path: "03-data-sources" },
  {
    id: "04-manual-scores",
    label: "3. 外部成績",
    path: "04-manual-scores",
  },
  { id: "05-boundaries", label: "4. 成績境界", path: "05-boundaries" },
  { id: "06-results", label: "5. 結果", path: "06-results" },
  { id: "07-export", label: "6. 出力", path: "07-export" },
]

/** パンくずに出すのは名前だけ（select の同一性を保つため外に置く） */
const selectGradeName = (grade: { name: string }) => grade.name

export default function GradeWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""
  // パンくずが要るのは名前だけ。成績本体のキャッシュを各段階と共有する
  const { data: examName = "" } = useQuery({
    queryKey: queryKeys.grade.detail(gradeId),
    queryFn: () => window.electronAPI.grade.getById(gradeId),
    select: selectGradeName,
  })

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            {workflowSteps.map((step, index) => {
              const isCurrentPage = pathname.includes(step.path)
              const linkHref = `/grades/${gradeId}/${step.path}`

              return (
                <React.Fragment key={step.id}>
                  <BreadcrumbItem>
                    {isCurrentPage ? (
                      <BreadcrumbPage className="font-semibold text-green-600">
                        {step.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={linkHref}>{step.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < workflowSteps.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center space-x-2">
          {examName && (
            <span className="text-sm text-muted-foreground">{examName}</span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/grades/${gradeId}`}>詳細</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/grades">一覧に戻る</Link>
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
