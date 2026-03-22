"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import React, { useEffect, useState } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"

const workflowSteps = [
  { id: "01-setup", label: "1. 基本設定", path: "01-setup" },
  { id: "02-students", label: "2. 生徒管理", path: "02-students" },
  { id: "03-data-sources", label: "3. データソース", path: "03-data-sources" },
  {
    id: "04-manual-scores",
    label: "4. 外部成績",
    path: "04-manual-scores",
  },
  { id: "05-boundaries", label: "5. 成績境界", path: "05-boundaries" },
  { id: "06-results", label: "6. 結果", path: "06-results" },
  { id: "07-export", label: "7. 出力", path: "07-export" },
]

export default function GradeWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""
  const [examName, setExamName] = useState<string>("")

  useEffect(() => {
    const loadExam = async () => {
      try {
        const result = await window.electronAPI.grade.getById(gradeId)
        if (result.success && result.grade) {
          setExamName(result.grade.name)
        }
      } catch (error) {
        console.error("Error loading grade exam:", error)
      }
    }
    loadExam()
  }, [gradeId])

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background flex items-center justify-between border-b px-4 py-3">
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
            <span className="text-muted-foreground text-sm">{examName}</span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/grades">一覧に戻る</Link>
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
