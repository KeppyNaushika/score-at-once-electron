"use client"

import {
  CircleCheck,
  CirclePlus,
  SkipForward,
  TriangleAlert,
} from "lucide-react"
import { useMemo } from "react"

import { resolveIdIntegrationRows } from "@/components/import/idIntegrationRows"
import { Button } from "@/components/ui/button"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"

interface FinalConfirmStepProps {
  wizard: StudentImportWizard
  onExecute: () => void
}

export function FinalConfirmStep({ wizard, onExecute }: FinalConfirmStepProps) {
  const { state } = wizard

  const summary = useMemo(() => {
    if (!state.fileOverviewData) return null

    const { student, classroom: classroomResult } = state.fileOverviewData
    const config = state.idIntegrationConfig

    // 取り込み時と同じ決まりで、行ごとの扱いを数える（id 一致は必ず同じもの）
    const countDecisions = (
      preMatch: typeof student,
      categoryConfig: typeof config.student
    ) => {
      const rows = resolveIdIntegrationRows(preMatch, categoryConfig)
      const countOf = (decisionType: string) =>
        rows.filter((row) => row.decision.decisionType === decisionType).length
      return {
        merge: preMatch.byId.length + countOf("same_person"),
        new: countOf("create_new"),
        skip: countOf("skip"),
      }
    }
    return {
      student: countDecisions(student, config.student),
      classroom: countDecisions(classroomResult, config.classroom),
    }
  }, [state.fileOverviewData, state.idIntegrationConfig])

  if (!summary) return null

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">最終確認</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          以下の内容で取り込みを実行します
        </p>
      </div>

      <div className="mx-auto grid max-w-lg gap-4">
        {/* 生徒サマリー */}
        <div className="rounded-lg border border-border/50 p-4">
          <h4 className="mb-3 font-medium">生徒</h4>
          <div className="space-y-2 text-sm">
            {summary.student.merge > 0 && (
              <div className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 text-green-500" />
                <span>既存データと紐づけ: {summary.student.merge}名</span>
              </div>
            )}
            {summary.student.new > 0 && (
              <div className="flex items-center gap-2">
                <CirclePlus className="h-4 w-4 text-blue-500" />
                <span>新規登録: {summary.student.new}名</span>
              </div>
            )}
            {summary.student.skip > 0 && (
              <div className="flex items-center gap-2">
                <SkipForward className="h-4 w-4 text-gray-500" />
                <span>スキップ: {summary.student.skip}名</span>
              </div>
            )}
          </div>
        </div>

        {/* 学級サマリー */}
        <div className="rounded-lg border border-border/50 p-4">
          <h4 className="mb-3 font-medium">学級</h4>
          <div className="space-y-2 text-sm">
            {summary.classroom.merge > 0 && (
              <div className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 text-green-500" />
                <span>既存データと紐づけ: {summary.classroom.merge}件</span>
              </div>
            )}
            {summary.classroom.new > 0 && (
              <div className="flex items-center gap-2">
                <CirclePlus className="h-4 w-4 text-blue-500" />
                <span>新規登録: {summary.classroom.new}件</span>
              </div>
            )}
            {summary.classroom.skip > 0 && (
              <div className="flex items-center gap-2">
                <SkipForward className="h-4 w-4 text-gray-500" />
                <span>スキップ: {summary.classroom.skip}件</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 警告 */}
      <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            この操作は元に戻せません。取り込み前にバックアップを取ることをお勧めします。
          </p>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={onExecute} size="lg">
          取り込みを実行
        </Button>
      </div>
    </div>
  )
}
