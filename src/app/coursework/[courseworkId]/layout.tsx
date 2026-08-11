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
  { id: "02-students", label: "1. 生徒管理", path: "02-students" },
  { id: "03-items", label: "2. 評価項目", path: "03-items" },
  { id: "04-scores", label: "3. 点数入力", path: "04-scores" },
  { id: "05-results", label: "4. 結果", path: "05-results" },
]

export default function CourseworkWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""
  const [courseworkName, setCourseworkName] = useState<string>("")

  useEffect(() => {
    const loadCoursework = async () => {
      try {
        const coursework =
          await window.electronAPI.coursework.getById(courseworkId)
        setCourseworkName(coursework.name)
      } catch (error) {
        console.error("Error loading coursework:", error)
      }
    }
    loadCoursework()
  }, [courseworkId])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            {workflowSteps.map((step, index) => {
              const isCurrentPage = pathname.includes(step.path)
              const linkHref = `/coursework/${courseworkId}/${step.path}`

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
          {courseworkName && (
            <span className="text-sm text-muted-foreground">
              {courseworkName}
            </span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/coursework/${courseworkId}`}>詳細</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/coursework">一覧に戻る</Link>
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
