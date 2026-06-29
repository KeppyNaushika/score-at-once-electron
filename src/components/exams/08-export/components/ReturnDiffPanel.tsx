"use client"

import { ArrowRight, FileCheck, Filter, PencilLine } from "lucide-react"
import { useState } from "react"

import type { Student } from "@/app/exams/[examId]/08-export/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type {
  ReturnScoreCellState,
  ReturnStudentDiff,
} from "@/electron-src/lib/prisma/returnSnapshot"

import { useReturnDiff } from "../hooks/useReturnDiff"

/** 採点判定コードを日本語表示に変換 */
const statusLabel = (status: string): string => {
  switch (status) {
    case "correct":
      return "正解"
    case "incorrect":
      return "不正解"
    case "partial":
      return "部分点"
    case "pending":
      return "保留"
    case "no_answer":
      return "無答"
    case "double_mark":
      return "二重マーク"
    case "unscored":
      return "未採点"
    default:
      return status
  }
}

/** セル状態を「判定（得点）」形式の文字列にする */
const cellText = (cell: ReturnScoreCellState | null): string => {
  if (!cell) return "（なし）"
  const label = statusLabel(cell.status)
  if (cell.value !== null) return `${label}（${cell.value}点）`
  return label
}

interface ReturnDiffPanelProps {
  examId: string
  /** 表示名解決用の生徒一覧（フィルタ前の全件が望ましい） */
  students: Student[]
  selectedStudents: Set<string>
  setSelectedStudents: (students: Set<string>) => void
}

/**
 * 答案返却・差分パネル。
 * 「返却版として記録」と、前回返却分から変更があった生徒の検出・絞り込みを行う。
 */
export function ReturnDiffPanel({
  examId,
  students,
  selectedStudents,
  setSelectedStudents,
}: ReturnDiffPanelProps) {
  const {
    diffByStudent,
    changedStudentIds,
    hasAnySnapshot,
    capturing,
    capture,
  } = useReturnDiff(examId)
  const [detailOpen, setDetailOpen] = useState(false)

  const studentName = (id: string): string => {
    const s = students.find((st) => st.id === id)
    return s ? `${s.lastName} ${s.firstName}` : id
  }

  // 変更があった生徒の差分（名前順は students の並びに従う）
  const changedDiffs: ReturnStudentDiff[] = students
    .map((s) => diffByStudent.get(s.id))
    .filter((d): d is ReturnStudentDiff => !!d && d.changed)

  const selectChangedOnly = () => {
    setSelectedStudents(new Set(changedStudentIds))
  }

  const handleCapture = async () => {
    await capture(Array.from(selectedStudents))
  }

  return (
    <Card className="shrink-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="h-4 w-4" />
          答案返却・差分
        </CardTitle>
        <CardDescription>
          現在の採点内容を「返却版」として記録すると、以降に採点（スコア・採点マーク）を
          修正した生徒だけを抽出して再印刷できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCapture}
            disabled={capturing || selectedStudents.size === 0}
          >
            <FileCheck className="mr-1 h-4 w-4" />
            選択中の{selectedStudents.size}名を返却版として記録
          </Button>

          {hasAnySnapshot && (
            <Button
              variant="outline"
              size="sm"
              onClick={selectChangedOnly}
              disabled={changedStudentIds.size === 0}
            >
              <Filter className="mr-1 h-4 w-4" />
              変更があった生徒のみ選択（{changedStudentIds.size}名）
            </Button>
          )}
        </div>

        {hasAnySnapshot ? (
          changedDiffs.length > 0 ? (
            <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2">
                  {detailOpen ? "変更内容を隠す" : "変更内容を表示"}（
                  {changedDiffs.length}名）
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
                {changedDiffs.map((diff) => (
                  <div
                    key={diff.studentId}
                    className="border-border rounded-md border p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      {studentName(diff.studentId)}
                      {diff.annotationChanged && (
                        <Badge variant="secondary" className="gap-1">
                          <PencilLine className="h-3 w-3" />
                          採点マーク変更
                        </Badge>
                      )}
                    </div>
                    {diff.scoreChanges.length > 0 ? (
                      <ul className="text-muted-foreground space-y-0.5">
                        {diff.scoreChanges.map((c) => (
                          <li
                            key={c.cropRegionId}
                            className="flex items-center gap-1.5"
                          >
                            <span className="text-foreground">
                              {c.label || "設問"}:
                            </span>
                            <span>{cellText(c.before)}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="text-foreground">
                              {cellText(c.after)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground">
                        採点マークのみ変更
                      </div>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <p className="text-muted-foreground text-sm">
              前回返却時から変更があった生徒はいません。
            </p>
          )
        ) : (
          <p className="text-muted-foreground text-sm">
            まだ返却版が記録されていません。出力対象の生徒を選んで「返却版として記録」してください。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
