"use client"

import { useMutation } from "@tanstack/react-query"
import { Check, ListChecks, ScanSearch } from "lucide-react"
import { type ComponentProps, type SetStateAction, useState } from "react"
import { toast } from "sonner"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  AiGradingAdoption,
  AiGradingAdoptionParts,
} from "@/electron-src/lib/prisma/aiGradingAdoption"
import { adoptAiGradingAttemptsMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { AiAdoptOverwriteDialog } from "./AiAdoptOverwriteDialog"
import { AiAnswerDetailPanel } from "./AiAnswerDetailPanel"
import { AiBulkActionsBar } from "./AiBulkActionsBar"
import { AiBulkAnnotationSection } from "./AiBulkAnnotationSection"
import { AiGridDisplaySection } from "./AiGridDisplaySection"
import { useAiAttemptShortcuts } from "./hooks/useAiGradingShortcuts"
import type { AiGridItem } from "./types"
import type { ReviewedAiGradingAnswer } from "./utils/answerReview"
import { neighborAttemptId } from "./utils/attemptSelection"
import { planSelectionAdoption } from "./utils/selectionAdoption"

/** 選んだ答案で、何を採用するか（点と朱書きは別に確定できる） */
const ADOPT_TARGETS = ["both", "score", "annotation"] as const
type AdoptTarget = (typeof ADOPT_TARGETS)[number]

const ADOPT_TARGET_LABELS: Record<AdoptTarget, string> = {
  both: "点と朱書き",
  score: "点だけ",
  annotation: "朱書きだけ",
}

const ADOPT_TARGET_PARTS: Record<AdoptTarget, AiGradingAdoptionParts> = {
  both: { score: true, annotation: true },
  score: { score: true, annotation: false },
  annotation: { score: false, annotation: true },
}

/** 上書きの確認を待っている採用 */
interface PendingOverwrite {
  adoptions: AiGradingAdoption[]
  examStudentIds: string[]
  overwriteCount: number
}

interface AiGradingSidePanelProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  currentUserId: string
  /** 試験の答案すべて（詳細の答案を複数ページで並べるのに要る） */
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** 「表示」節に渡すもの */
  displaySection: ComponentProps<typeof AiGridDisplaySection>
  reviewedAnswers: ReviewedAiGradingAnswer[]
  selectedItems: AiGridItem[]
  singleSelectedItem: AiGridItem | null
  promptNumberById: ReadonlyMap<string, number>
  onChooseAttempt: (examStudentId: string, attemptId: string) => void
  draftAnnotationsByAttemptId: ReadonlyMap<string, DrawingAnnotation[]>
  onDraftChange: (
    attemptId: string,
    seedAnnotations: DrawingAnnotation[],
    action: SetStateAction<DrawingAnnotation[]>
  ) => void
  /** 採用を書き込んだ答案（絞り込みから外れても一覧に残す） */
  onAdopted: (examStudentIds: readonly string[]) => void
  /** 詳細で保存した注釈を変えた */
  onAnnotationChanged: () => void
}

/**
 * AI採点モードの右パネル（8. 採点確定の右パネルと同じ並び）。
 * 表示（絞り込み・件数・並べ方）→ まとめての操作 → 選んだ答案の詳細。
 *
 * **採用はここが書く。** I・採用ボタンは選んだ答案すべての表示中の試行を採用し、
 * 選んだ中に自分が採点済みの答案があれば件数を示して1回だけ上書きを確かめる
 */
export function AiGradingSidePanel({
  examId,
  cropRegion,
  pageSize,
  currentUserId,
  studentAnswerImages,
  displaySection,
  reviewedAnswers,
  selectedItems,
  singleSelectedItem,
  promptNumberById,
  onChooseAttempt,
  draftAnnotationsByAttemptId,
  onDraftChange,
  onAdopted,
  onAnnotationChanged,
}: AiGradingSidePanelProps) {
  const adopt = useMutation(
    adoptAiGradingAttemptsMutation(examId, cropRegion.id)
  )
  const [pendingOverwrite, setPendingOverwrite] =
    useState<PendingOverwrite | null>(null)
  const [adoptTarget, setAdoptTarget] = useState<AdoptTarget>("both")
  const adoptParts = ADOPT_TARGET_PARTS[adoptTarget]

  const writeAdoptions = (
    { adoptions, examStudentIds }: Omit<PendingOverwrite, "overwriteCount">,
    overwrite: boolean
  ) => {
    adopt.mutate(
      { adoptions, overwrite, parts: adoptParts },
      {
        onSuccess: (results) => {
          const adoptedCount = results.filter(
            (result) => result.outcome === "adopted"
          ).length
          if (adoptedCount > 0) {
            toast.success(`AI の判定を${adoptedCount}件採用しました`)
          } else {
            toast.info("採用しませんでした（採点済み・判定なし等）")
          }
          onAdopted(examStudentIds)
        },
      }
    )
  }

  const requestAdopt = () => {
    if (adopt.isPending || pendingOverwrite) return
    const { adoptions, overwriteCount, skippedCount } = planSelectionAdoption(
      selectedItems.map((gridItem) => gridItem.reviewedAnswer),
      { cropRegion, pageSize, draftAnnotationsByAttemptId }
    )
    if (adoptions.length === 0) {
      toast.info("選んだ答案に採用できる AI の判定がありません")
      return
    }
    if (skippedCount > 0) {
      toast.info(`AI の判定が無い答案${skippedCount}件は採用しません`)
    }
    const examStudentIds = selectedItems.map((gridItem) => gridItem.id)
    // 上書きの確認は点を書くときだけ（朱書きだけなら採点済みの点には触れない）
    if (adoptParts.score && overwriteCount > 0) {
      setPendingOverwrite({ adoptions, examStudentIds, overwriteCount })
    } else {
      writeAdoptions({ adoptions, examStudentIds }, false)
    }
  }

  // `<` `>` は答案を1つだけ選んでいるときに、その答案の試行を見比べる
  const showNeighborAttempt = (direction: "older" | "newer") => {
    if (!singleSelectedItem) return
    const { answer, review } = singleSelectedItem.reviewedAnswer
    const attemptId = neighborAttemptId(
      answer.attempts,
      review.displayedAttempt?.attempt.id ?? null,
      direction
    )
    if (attemptId) onChooseAttempt(singleSelectedItem.id, attemptId)
  }
  useAiAttemptShortcuts({
    onPrevAttempt: () => showNeighborAttempt("older"),
    onNextAttempt: () => showNeighborAttempt("newer"),
    onAdopt: requestAdopt,
  })

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-gray-200 bg-white px-3">
      <AiGridDisplaySection {...displaySection} />

      <SidePanelSection icon={ListChecks} title="まとめての操作">
        <div className="space-y-2">
          <Select
            value={adoptTarget}
            onValueChange={(value) => {
              const chosen = ADOPT_TARGETS.find((target) => target === value)
              if (chosen) setAdoptTarget(chosen)
            }}
          >
            <SelectTrigger className="h-8 w-full" aria-label="採用するもの">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADOPT_TARGETS.map((target) => (
                <SelectItem key={target} value={target}>
                  採用するもの: {ADOPT_TARGET_LABELS[target]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            size="sm"
            onClick={requestAdopt}
            disabled={selectedItems.length === 0 || adopt.isPending}
          >
            <Check className="h-4 w-4" />
            選んだ {selectedItems.length} 件の{ADOPT_TARGET_LABELS[adoptTarget]}
            を採用
            <Kbd variant="tiny">I</Kbd>
          </Button>
          <AiBulkActionsBar
            examId={examId}
            cropRegion={cropRegion}
            pageSize={pageSize}
            reviewedAnswers={reviewedAnswers}
            draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
          />
          <AiBulkAnnotationSection
            examId={examId}
            cropRegion={cropRegion}
            pageSize={pageSize}
            reviewedAnswers={reviewedAnswers}
            draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
          />
        </div>
      </SidePanelSection>

      <SidePanelSection icon={ScanSearch} title="選んだ答案">
        {singleSelectedItem ? (
          <AiAnswerDetailPanel
            key={singleSelectedItem.id}
            gridItem={singleSelectedItem}
            cropRegion={cropRegion}
            currentUserId={currentUserId}
            studentAnswerImages={studentAnswerImages}
            pageSize={pageSize}
            draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
            onDraftChange={onDraftChange}
            onAnnotationChanged={onAnnotationChanged}
            promptNumberById={promptNumberById}
            onPrevAttempt={() => showNeighborAttempt("older")}
            onNextAttempt={() => showNeighborAttempt("newer")}
            onAdopt={requestAdopt}
            isAdopting={adopt.isPending}
          />
        ) : (
          <p className="py-2 text-xs text-muted-foreground">
            答案を1つだけ選ぶと、朱書きを直したり、AI の判定を見比べたりできます
          </p>
        )}
      </SidePanelSection>

      <AiAdoptOverwriteDialog
        pendingOverwrite={
          pendingOverwrite && {
            adoptionCount: pendingOverwrite.adoptions.length,
            overwriteCount: pendingOverwrite.overwriteCount,
          }
        }
        onConfirm={() => {
          if (pendingOverwrite) writeAdoptions(pendingOverwrite, true)
          setPendingOverwrite(null)
        }}
        onCancel={() => setPendingOverwrite(null)}
      />
    </div>
  )
}
