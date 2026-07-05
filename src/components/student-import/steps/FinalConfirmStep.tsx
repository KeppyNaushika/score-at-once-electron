"use client"

import {
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  SkipForward,
} from "lucide-react"
import { useMemo } from "react"

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

    // 生徒サマリー
    const studentAutoMatched = student.byId.length
    const studentSecondaryMatched =
      (student.byStudentNumber?.length ?? 0) + (student.byName?.length ?? 0)
    const studentNoMatch = student.noMatch.length

    let studentMerge = studentAutoMatched
    let studentNew = 0
    let studentSkip = 0

    if (config.student.strategy === "all_new") {
      studentNew = studentSecondaryMatched + studentNoMatch
    } else {
      studentMerge += studentSecondaryMatched
      studentNew = studentNoMatch
    }

    // 個別決定をカウント
    for (const decision of config.student.decisions) {
      if (decision.decisionType === "create_new") studentNew++
      else if (decision.decisionType === "skip") studentSkip++
    }

    // 学級サマリー
    const classroomAutoMatched = classroomResult.byId.length
    const classroomSecondaryMatched = classroomResult.byName?.length ?? 0
    const classroomNoMatch = classroomResult.noMatch.length

    let classroomMerge = classroomAutoMatched
    let classroomNew = 0
    let classroomSkip = 0

    if (config.classroom.strategy === "all_new") {
      classroomNew = classroomSecondaryMatched + classroomNoMatch
    } else {
      classroomMerge += classroomSecondaryMatched
      classroomNew = classroomNoMatch
    }

    for (const decision of config.classroom.decisions) {
      if (decision.decisionType === "create_new") classroomNew++
      else if (decision.decisionType === "skip") classroomSkip++
    }

    return {
      student: { merge: studentMerge, new: studentNew, skip: studentSkip },
      classroom: {
        merge: classroomMerge,
        new: classroomNew,
        skip: classroomSkip,
      },
    }
  }, [state.fileOverviewData, state.idIntegrationConfig])

  if (!summary) return null

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">最終確認</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          以下の内容でインポートを実行します
        </p>
      </div>

      <div className="mx-auto grid max-w-lg gap-4">
        {/* 生徒サマリー */}
        <div className="border-border/50 rounded-lg border p-4">
          <h4 className="mb-3 font-medium">生徒</h4>
          <div className="space-y-2 text-sm">
            {summary.student.merge > 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>既存データと紐づけ: {summary.student.merge}名</span>
              </div>
            )}
            {summary.student.new > 0 && (
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-blue-500" />
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
        <div className="border-border/50 rounded-lg border p-4">
          <h4 className="mb-3 font-medium">学級</h4>
          <div className="space-y-2 text-sm">
            {summary.classroom.merge > 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>既存データと紐づけ: {summary.classroom.merge}件</span>
              </div>
            )}
            {summary.classroom.new > 0 && (
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-blue-500" />
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
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            この操作は元に戻せません。インポート前にバックアップを取ることをお勧めします。
          </p>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={onExecute} size="lg">
          インポートを実行
        </Button>
      </div>
    </div>
  )
}
