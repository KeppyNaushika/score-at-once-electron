"use client"

import { useMutation } from "@tanstack/react-query"
import { Users } from "lucide-react"
import { useState } from "react"

import { CheckboxCellWithFillHandle } from "@/components/exams/shared/CheckboxCellWithFillHandle"
import type { FillUpdate } from "@/components/exams/shared/useFillHandleDrag"
import { useFillHandleDrag } from "@/components/exams/shared/useFillHandleDrag"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { CropRegionRow } from "@/queries/cropRegion"
import {
  assignCropRegionMutation,
  unassignCropRegionMutation,
} from "@/queries/scoring"
import type { ExamMemberRow } from "@/queries/userExam"

/** 対応表の列。試験の参加者そのもの（`id` が採点者の userId） */
type Grader = ExamMemberRow["user"]

/** 割当が1つも無い設問。毎回新しい集合を作らないための空値 */
const EMPTY_ASSIGNED_USER_IDS: ReadonlySet<string> = new Set()

interface GraderAssignmentTableProps {
  examId: string
  /** 行。**QUESTION_ANSWER だけ**（採点担当は設問にしか付かない） */
  questionRegions: CropRegionRow[]
  /** 列。試験の参加者 */
  graders: Grader[]
  /**
   * どのマスに担当が入っているか。**採点領域id と利用者id の対で引く。**
   * 行番号・列番号から引くと、取り直しで並びが変わった瞬間に別の設問・別の
   * 採点者へ書くことになる（このリポジトリは一度それで壊している）。
   */
  assignedUserIdsByCropRegionId: ReadonlyMap<string, ReadonlySet<string>>
  /** 追加・解除ができるか（試験の所有者のみ）。false でも対応表は読める */
  canManage: boolean
}

/**
 * 設問 × 採点者の対応表。
 *
 * **担当を直す口はここ1か所だけ。** 設問ごとにドロップダウンを開く形だと、
 * 30問 × 3人で最大90回押すことになる。行と列が一望できる対応表なら、
 * フィルハンドル（マス右下をつまんで縦にドラッグ）で連続した設問へまとめて
 * 入れられる。操作感は 04（設問と小計項目の対応表）と同じものを使う。
 *
 * **マスの読み書きは (cropRegionId, userId) のペアで行う。** 表示の並び順は
 * ループの入れ子だけが持ち、書き込み先の決定には一切使わない。
 */
export function GraderAssignmentTable({
  examId,
  questionRegions,
  graders,
  assignedUserIdsByCropRegionId,
  canManage,
}: GraderAssignmentTableProps) {
  const currentUser = useCurrentUser()
  const assignCropRegion = useMutation(assignCropRegionMutation(examId))
  const unassignCropRegion = useMutation(unassignCropRegionMutation(examId))
  const isSaving = assignCropRegion.isPending || unassignCropRegion.isPending

  // 選択中のマス。フィルハンドルは選択中のマスにだけ出る（04 と同じ）
  const [selectedCell, setSelectedCell] = useState<{
    cropRegionId: string
    userId: string
  } | null>(null)

  /** そのマスに担当が入っているか */
  const isAssigned = (cropRegion: CropRegionRow, grader: Grader): boolean =>
    (
      assignedUserIdsByCropRegionId.get(cropRegion.id) ??
      EMPTY_ASSIGNED_USER_IDS
    ).has(grader.id)

  /** マス1つの担当を付け外しする。既にその姿なら何も書かない */
  const setCellAssignment = async (
    cropRegion: CropRegionRow,
    grader: Grader,
    checked: boolean
  ): Promise<void> => {
    if (isAssigned(cropRegion, grader) === checked) return

    try {
      if (checked) {
        await assignCropRegion.mutateAsync({
          cropRegionId: cropRegion.id,
          userId: grader.id,
          assignedByUserId: currentUser.id,
        })
      } else {
        await unassignCropRegion.mutateAsync({
          cropRegionId: cropRegion.id,
          userId: grader.id,
          requestedByUserId: currentUser.id,
        })
      }
    } catch {
      // 失敗の通知と取り直しは MutationCache の後始末が担う。ここで受けるのは
      // 投げっぱなしの拒否を作らないため
    }
  }

  /**
   * フィルハンドルで塗った範囲を保存する。
   *
   * マス1つが割当1レコードなので、塗った分だけ書く。**1つずつ待たない**のは、
   * `scope` が実行を直列にしつつ順番待ちの間も pending として数えるため
   * （取り直しの畳み込みが効き、最後の1件だけが取り直す）。
   */
  const fillCells = async (
    updates: FillUpdate<CropRegionRow, Grader>[]
  ): Promise<void> => {
    await Promise.all(
      updates.map((update) =>
        setCellAssignment(update.row, update.col, update.value)
      )
    )
  }

  const {
    handleFillHandlePointerDown,
    handleCellPointerEnter,
    handlePointerUp,
    isInFillRange,
  } = useFillHandleDrag({
    rows: questionRegions,
    cols: graders,
    onFillComplete: fillCells,
  })

  /** その採点者が担当している設問の数（割り振りの偏りを見るため） */
  const assignedQuestionCountOf = (grader: Grader): number =>
    questionRegions.filter((questionRegion) =>
      isAssigned(questionRegion, grader)
    ).length

  if (questionRegions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>設問がありません</p>
        <p className="text-sm">
          「領域情報」タブで種類を「設問解答」にすると、ここに並びます
        </p>
      </div>
    )
  }

  if (graders.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>参加している先生がいません</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <span className="font-medium">設問ごとの採点担当</span>
        {isSaving && (
          <Badge variant="outline" className="bg-blue-50 text-xs text-blue-700">
            保存中...
          </Badge>
        )}
        {!canManage && (
          <Badge variant="outline" className="text-xs">
            読み取り専用（担当を決められるのは試験の所有者だけです）
          </Badge>
        )}
      </div>

      <div className="rounded-lg border">
        <div
          className="relative w-full overflow-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0, 0, 0, 0.2) transparent",
          }}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <Table className="w-auto" style={{ width: "fit-content" }}>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="sticky top-0 left-0 z-30 border-r-2 border-gray-200 bg-white px-2 py-1 text-center"
                  style={{
                    width: "160px",
                    minWidth: "160px",
                    maxWidth: "160px",
                  }}
                >
                  設問
                </TableHead>
                {graders.map((grader) => (
                  <TableHead
                    key={grader.id}
                    className="sticky top-0 z-20 bg-blue-50/50 px-3 text-center"
                  >
                    <div className="text-sm font-semibold text-blue-700">
                      {grader.name}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {assignedQuestionCountOf(grader)}問
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 並び順はこの入れ子だけが持つ。添字は塗る範囲の計算にしか渡さない */}
              {questionRegions.map((questionRegion, rowIndex) => (
                <TableRow key={questionRegion.id}>
                  <TableCell
                    className="sticky left-0 z-10 border-r-2 border-gray-200 bg-white px-2 py-1"
                    style={{
                      width: "160px",
                      minWidth: "160px",
                      maxWidth: "160px",
                    }}
                  >
                    <div className="flex items-center gap-1 overflow-hidden">
                      <div className="flex-1 truncate text-sm font-medium">
                        {questionRegion.label || `問${rowIndex + 1}`}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {questionRegion.points ?? 0}
                      </Badge>
                    </div>
                  </TableCell>
                  {graders.map((grader, colIndex) => (
                    <TableCell
                      key={grader.id}
                      className="p-0 text-center"
                      onPointerEnter={() =>
                        handleCellPointerEnter({
                          row: questionRegion,
                          col: grader,
                          rowIndex,
                          colIndex,
                        })
                      }
                    >
                      <CheckboxCellWithFillHandle
                        checked={isAssigned(questionRegion, grader)}
                        onChange={(checked) =>
                          setCellAssignment(questionRegion, grader, checked)
                        }
                        onFillHandleDragStart={(e, initialValue) => {
                          e.preventDefault()
                          handleFillHandlePointerDown(
                            {
                              row: questionRegion,
                              col: grader,
                              rowIndex,
                              colIndex,
                            },
                            initialValue
                          )
                        }}
                        onCellClick={() =>
                          setSelectedCell({
                            cropRegionId: questionRegion.id,
                            userId: grader.id,
                          })
                        }
                        isSelected={
                          selectedCell?.cropRegionId === questionRegion.id &&
                          selectedCell?.userId === grader.id
                        }
                        disabled={!canManage || isSaving}
                        isInFillRange={isInFillRange(questionRegion, grader)}
                        disableFillHandle={!canManage}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/*
        「担当0人＝全員が担当」はここで一度だけ言う。列が全部空の行が
        「誰も採点できない」に見えると、割り当てを埋めないと先へ進めないと
        誤解される（実際には割当は絞り込みであって、採点の可否ではない）
      */}
      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <h4 className="mb-2 font-medium">使い方:</h4>
        <ul className="ml-4 space-y-1">
          <li>
            •{" "}
            <strong>
              チェックが1つも無い設問は、全員が採点できます（担当なし＝全員）
            </strong>
            。割り当ては採点画面に出る設問を絞るためのもので、割り当てを忘れても採点が止まることはありません
          </li>
          <li>
            • チェックを入れると、その先生の採点画面にはその設問だけが並びます
          </li>
          <li>
            •{" "}
            <strong>
              マスを選んでから右下角（フィルハンドル）をドラッグすると、連続した設問へまとめて入れられます
            </strong>
            （Excel風）
          </li>
          <li>
            • <strong>変更は自動で保存されます</strong>（逐次保存）
          </li>
          <li>• 採点結果が食い違ったときの裁定は「8. 採点確定」で行います</li>
        </ul>
      </div>
    </div>
  )
}
