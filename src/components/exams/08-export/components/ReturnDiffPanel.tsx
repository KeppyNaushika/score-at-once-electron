"use client"

import {
  ArrowRight,
  FileCheck,
  Filter,
  HelpCircle,
  PencilLine,
} from "lucide-react"
import { useState } from "react"

import { CaptureReturnVersionButton } from "@/components/exams/08-export/components/CaptureReturnVersionButton"
import type { Student } from "@/components/exams/08-export/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type {
  ReturnScoreCellState,
  ReturnStudentDiff,
} from "@/electron-src/lib/prisma/returnSnapshot"

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
  /** 表示名解決用の生徒一覧（フィルタ前の全件が望ましい） */
  students: Student[]
  /** 現在の選択（「返却版として記録」対象・件数表示に使う） */
  selectedExamStudentIds: string[]
  /** 選択を差し替える（「変更があった生徒のみ選択」） */
  onSelectExamStudentIds: (examStudentIds: string[]) => void
  /** 生徒ID → 返却版との差分 */
  diffByExamStudent: Map<string, ReturnStudentDiff>
  /** 返却版から変更があった生徒IDの集合 */
  changedExamStudentIds: Set<string>
  /** 返却版スナップショットが1件でも存在するか */
  hasAnySnapshot: boolean
  /** 返却版記録の実行中フラグ */
  capturing: boolean
  /** 指定生徒を返却版として記録する */
  capture: (examStudentIds: string[]) => Promise<boolean>
}

/**
 * 答案返却・差分パネル。
 * 「返却版として記録」と、前回返却分から変更があった生徒の検出・絞り込みを行う。
 * 返却差分の状態は親（ExportMainView）で管理し props で受け取る。
 */
export function ReturnDiffPanel({
  students,
  selectedExamStudentIds,
  onSelectExamStudentIds,
  diffByExamStudent,
  changedExamStudentIds,
  hasAnySnapshot,
  capturing,
  capture,
}: ReturnDiffPanelProps) {
  const [detailOpen, setDetailOpen] = useState(false)

  // 変更があった生徒の差分（受験生徒実体をペアで保持。順序は students の並びに従う）
  const changedDiffs = students
    .map((examStudent) => ({
      examStudent,
      diff: diffByExamStudent.get(examStudent.id),
    }))
    .filter(
      (pair): pair is { examStudent: Student; diff: ReturnStudentDiff } =>
        !!pair.diff && pair.diff.changed
    )

  const selectChangedOnly = () => {
    onSelectExamStudentIds(Array.from(changedExamStudentIds))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <CaptureReturnVersionButton
          selectedExamStudentIds={selectedExamStudentIds}
          capturing={capturing}
          capture={capture}
          label={`選択中の${selectedExamStudentIds.length}名を返却版として記録`}
        />

        {hasAnySnapshot && (
          <Button
            variant="outline"
            size="sm"
            onClick={selectChangedOnly}
            disabled={changedExamStudentIds.size === 0}
          >
            <Filter className="mr-1 h-4 w-4" />
            変更があった生徒のみ選択（{changedExamStudentIds.size}名）
          </Button>
        )}

        {/* 機能説明（Popover） */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="答案返却・差分の説明"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <FileCheck className="h-4 w-4" />
              答案返却・差分
            </div>
            <p className="mt-2 text-muted-foreground">
              現在の採点内容を「返却版」として記録すると、以降に採点（スコア・採点マーク）を
              修正した生徒だけを抽出して再印刷できます。
            </p>
          </PopoverContent>
        </Popover>
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
              {changedDiffs.map(({ examStudent, diff }) => (
                <div
                  key={diff.examStudentId}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    {examStudent.student.lastName}{" "}
                    {examStudent.student.firstName}
                    {diff.annotationChanged && (
                      <Badge variant="secondary" className="gap-1">
                        <PencilLine className="h-3 w-3" />
                        採点マーク変更
                      </Badge>
                    )}
                  </div>
                  {diff.scoreChanges.length > 0 ? (
                    <ul className="space-y-0.5 text-muted-foreground">
                      {diff.scoreChanges.map((scoreChange) => (
                        <li
                          key={scoreChange.cropRegionId}
                          className="flex items-center gap-1.5"
                        >
                          <span className="text-foreground">
                            {scoreChange.label || "設問"}:
                          </span>
                          <span>{cellText(scoreChange.before)}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span className="text-foreground">
                            {cellText(scoreChange.after)}
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
          <p className="text-sm text-muted-foreground">
            前回返却時から変更があった生徒はいません。
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          まだ返却版が記録されていません。出力対象の生徒を選んで「返却版として記録」してください。
        </p>
      )}
    </div>
  )
}
