"use client"

import { CheckCircle2, ChevronRight, HelpCircle, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"
import type { PreMatchingResult } from "@/types/examArchive.types"

interface FileOverviewStepProps {
  wizard: StudentImportWizard
}

function CategoryOverviewCard({
  title,
  icon: Icon,
  result,
}: {
  title: string
  icon: React.ElementType
  result: PreMatchingResult
}) {
  const autoMatched = result.byId.length
  const secondaryMatched =
    (result.byStudentNumber?.length ?? 0) + (result.byName?.length ?? 0)
  const noMatch = result.noMatch.length
  const total = autoMatched + secondaryMatched + noMatch

  return (
    <div className="border-border/50 rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="text-muted-foreground h-5 w-5" />
        <h4 className="font-medium">{title}</h4>
        <span className="text-muted-foreground text-sm">（{total}件）</span>
      </div>

      <div className="space-y-2 text-sm">
        {autoMatched > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>自動で紐づく: {autoMatched}件</span>
          </div>
        )}
        {secondaryMatched > 0 && (
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-500" />
            <span>確認が必要: {secondaryMatched}件</span>
          </div>
        )}
        {noMatch > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span>新規登録: {noMatch}件</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function FileOverviewStep({ wizard }: FileOverviewStepProps) {
  const { state, goToNextStep } = wizard

  if (!state.fileOverviewData || !state.manifest) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        データを読み込んでいます...
      </div>
    )
  }

  const { student, classroom: classroomResult } = state.fileOverviewData
  const { counts } = state.manifest

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">ファイルの内容</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          生徒 {counts.students}名、学級 {counts.classrooms}件、所属{" "}
          {counts.memberships}件
        </p>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4">
        <CategoryOverviewCard title="生徒" icon={Users} result={student} />
        <CategoryOverviewCard
          title="学級"
          icon={Users}
          result={classroomResult}
        />
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={goToNextStep} className="gap-2">
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
