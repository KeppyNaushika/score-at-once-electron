"use client"

import type { Classroom } from "@prisma/client"
import { useMutation } from "@tanstack/react-query"
import { ChevronDown, Users } from "lucide-react"
import { useMemo, useState } from "react"

import { CheckboxCellWithFillHandle } from "@/components/exams/shared/CheckboxCellWithFillHandle"
import type { FillUpdate } from "@/components/exams/shared/useFillHandleDrag"
import { useFillHandleDrag } from "@/components/exams/shared/useFillHandleDrag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import { setExamStudentAssignmentsMutation } from "@/queries/scoring"
import type { ExamMemberRow } from "@/queries/userExam"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/** 対応表の列。試験の参加者そのもの（`id` が採点者の userId） */
type Grader = ExamMemberRow["user"]

/** 割当が1つも無い生徒。毎回新しい集合を作らないための空値 */
const EMPTY_ASSIGNED_USER_IDS: ReadonlySet<string> = new Set()

interface StudentGraderAssignmentTableProps {
  examId: string
  /** 行。受験生徒一覧と同じ並び */
  examStudents: ExamStudentWithMemberships[]
  /** 採番学級（studentId → 学級・出席番号）。行の見出しと学級からの一括に使う */
  placementByStudent: Record<string, ExamClassroomPlacement>
  /** 列。試験の参加者 */
  graders: Grader[]
  /**
   * どのマスに担当が入っているか。**受験生徒id と利用者id の対で引く**
   * （行番号・列番号から引くと、取り直しで並びが変わった瞬間に別の生徒へ書く）。
   */
  assignedUserIdsByExamStudentId: ReadonlyMap<string, ReadonlySet<string>>
  /** 追加・解除ができるか（試験の所有者のみ）。false でも対応表は読める */
  canManage: boolean
}

/**
 * 受験生徒 × 採点者の対応表（docs/scoring-scope-and-permissions-design.md §3-1）。
 *
 * 設問の担当（03 の `GraderAssignmentTable`）と対等な軸で、操作感も同じにする
 * （マスのチェックと、右下をつまんで縦に塗るフィルハンドル）。
 *
 * **学級は担当の鍵にしない。** 列見出しの「学級から」は、その学級の生徒の行へ
 * 担当を焼き込むだけで、後から所属が変わっても担当は揺れない。学級は採番学級
 * （受験日時点の所属。受験生徒一覧の学級と同じ）で決める。
 */
export function StudentGraderAssignmentTable({
  examId,
  examStudents,
  placementByStudent,
  graders,
  assignedUserIdsByExamStudentId,
  canManage,
}: StudentGraderAssignmentTableProps) {
  const currentUser = useCurrentUser()
  const setAssignments = useMutation(setExamStudentAssignmentsMutation(examId))
  const isSaving = setAssignments.isPending

  // 選択中のマス。フィルハンドルは選択中のマスにだけ出る（03 と同じ）
  const [selectedCell, setSelectedCell] = useState<{
    examStudentId: string
    userId: string
  } | null>(null)

  /** 一括で選べる学級。採番学級の並び（学級の関連付けの順）で、受験生徒がいる学級だけ */
  const classrooms = useMemo(() => {
    const classroomById = new Map<
      string,
      { classroom: Classroom; order: number }
    >()
    for (const examStudent of examStudents) {
      const placement = placementByStudent[examStudent.studentId]
      if (!placement?.classroom) continue
      classroomById.set(placement.classroom.id, {
        classroom: placement.classroom,
        order: placement.order ?? Number.MAX_SAFE_INTEGER,
      })
    }
    return [...classroomById.values()]
      .sort((entryA, entryB) => entryA.order - entryB.order)
      .map((entry) => entry.classroom)
  }, [examStudents, placementByStudent])

  /** そのマスに担当が入っているか */
  const isAssigned = (
    examStudent: ExamStudentWithMemberships,
    grader: Grader
  ): boolean =>
    (
      assignedUserIdsByExamStudentId.get(examStudent.id) ??
      EMPTY_ASSIGNED_USER_IDS
    ).has(grader.id)

  /** 1人の採点者について、何人かの担当をまとめて付け外しする */
  const setGraderAssignments = async (
    grader: Grader,
    targetExamStudents: ExamStudentWithMemberships[],
    assigned: boolean
  ): Promise<void> => {
    // 既にその姿の生徒は送らない（送っても main が書かないが、往復を省く）
    const changedExamStudentIds = targetExamStudents
      .filter((examStudent) => isAssigned(examStudent, grader) !== assigned)
      .map((examStudent) => examStudent.id)
    if (changedExamStudentIds.length === 0) return
    try {
      await setAssignments.mutateAsync({
        userId: grader.id,
        examStudentIds: changedExamStudentIds,
        assigned,
        requestedByUserId: currentUser.id,
      })
    } catch {
      // 失敗の通知と取り直しは MutationCache の後始末が担う。ここで受けるのは
      // 投げっぱなしの拒否を作らないため
    }
  }

  /**
   * フィルハンドルで塗った範囲を保存する。採点者と「付ける・外す」の組ごとに1回で送る
   * （塗った生徒の数だけ往復しない）。
   */
  const fillCells = async (
    updates: FillUpdate<ExamStudentWithMemberships, Grader>[]
  ): Promise<void> => {
    const groups = new Map<
      string,
      {
        grader: Grader
        assigned: boolean
        examStudents: ExamStudentWithMemberships[]
      }
    >()
    for (const update of updates) {
      const groupKey = `${update.col.id}:${update.value}`
      const group = groups.get(groupKey) ?? {
        grader: update.col,
        assigned: update.value,
        examStudents: [],
      }
      group.examStudents.push(update.row)
      groups.set(groupKey, group)
    }
    await Promise.all(
      [...groups.values()].map((group) =>
        setGraderAssignments(group.grader, group.examStudents, group.assigned)
      )
    )
  }

  const {
    handleFillHandlePointerDown,
    handleCellPointerEnter,
    handlePointerUp,
    isInFillRange,
  } = useFillHandleDrag({
    rows: examStudents,
    cols: graders,
    onFillComplete: fillCells,
  })

  /** その学級の受験生徒（採番学級で決める） */
  const examStudentsOfClassroom = (classroomId: string) =>
    examStudents.filter(
      (examStudent) =>
        placementByStudent[examStudent.studentId]?.classroom?.id === classroomId
    )

  /** その採点者が担当している生徒の数（割り振りの偏りを見るため） */
  const assignedStudentCountOf = (grader: Grader): number =>
    examStudents.filter((examStudent) => isAssigned(examStudent, grader)).length

  /** 行の見出し。学級と出席番号があれば添える */
  const rowLabelOf = (examStudent: ExamStudentWithMemberships) => {
    const placement = placementByStudent[examStudent.studentId]
    const seat =
      placement?.classroom && placement.attendanceNumber !== null
        ? `${placement.classroom.name} ${placement.attendanceNumber}番`
        : (placement?.classroom?.name ?? "学級なし")
    return {
      seat,
      name: `${examStudent.student.lastName} ${examStudent.student.firstName}`,
    }
  }

  if (examStudents.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>受験生徒がいません</p>
        <p className="text-sm">
          「受験生徒一覧」で生徒を追加すると、ここに並びます
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <span className="font-medium">生徒ごとの採点担当</span>
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
          className="relative max-h-[60vh] w-full overflow-auto"
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
                    width: "220px",
                    minWidth: "220px",
                    maxWidth: "220px",
                  }}
                >
                  生徒
                </TableHead>
                {graders.map((grader) => (
                  <TableHead
                    key={grader.id}
                    className="sticky top-0 z-20 bg-blue-50 px-3 py-1 text-center"
                  >
                    <div className="text-sm font-semibold text-blue-700">
                      {grader.name}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {assignedStudentCountOf(grader)}人
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={isSaving}
                          >
                            学級から
                            <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          <DropdownMenuLabel className="text-xs">
                            {grader.name}の担当にする
                          </DropdownMenuLabel>
                          {classrooms.length === 0 && (
                            <DropdownMenuItem disabled>
                              学級に属する受験生徒がいません
                            </DropdownMenuItem>
                          )}
                          {classrooms.map((classroom) => (
                            <DropdownMenuItem
                              key={classroom.id}
                              onSelect={() =>
                                setGraderAssignments(
                                  grader,
                                  examStudentsOfClassroom(classroom.id),
                                  true
                                )
                              }
                            >
                              {classroom.name}
                              <span className="ml-auto pl-3 text-xs text-muted-foreground">
                                {examStudentsOfClassroom(classroom.id).length}人
                              </span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              setGraderAssignments(grader, examStudents, false)
                            }
                          >
                            {grader.name}の担当をすべて外す
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 並び順はこの入れ子だけが持つ。添字は塗る範囲の計算にしか渡さない */}
              {examStudents.map((examStudent, rowIndex) => {
                const rowLabel = rowLabelOf(examStudent)
                return (
                  <TableRow key={examStudent.id}>
                    <TableCell
                      className="sticky left-0 z-10 border-r-2 border-gray-200 bg-white px-2 py-1"
                      style={{
                        width: "220px",
                        minWidth: "220px",
                        maxWidth: "220px",
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {rowLabel.seat}
                        </span>
                        <span className="flex-1 truncate text-sm font-medium">
                          {rowLabel.name}
                        </span>
                      </div>
                    </TableCell>
                    {graders.map((grader, colIndex) => (
                      <TableCell
                        key={grader.id}
                        className="p-0 text-center"
                        onPointerEnter={() =>
                          handleCellPointerEnter({
                            row: examStudent,
                            col: grader,
                            rowIndex,
                            colIndex,
                          })
                        }
                      >
                        <CheckboxCellWithFillHandle
                          checked={isAssigned(examStudent, grader)}
                          onChange={(checked) =>
                            setGraderAssignments(grader, [examStudent], checked)
                          }
                          onFillHandleDragStart={(e, initialValue) => {
                            e.preventDefault()
                            handleFillHandlePointerDown(
                              {
                                row: examStudent,
                                col: grader,
                                rowIndex,
                                colIndex,
                              },
                              initialValue
                            )
                          }}
                          onCellClick={() =>
                            setSelectedCell({
                              examStudentId: examStudent.id,
                              userId: grader.id,
                            })
                          }
                          isSelected={
                            selectedCell?.examStudentId === examStudent.id &&
                            selectedCell?.userId === grader.id
                          }
                          disabled={!canManage || isSaving}
                          isInFillRange={isInFillRange(examStudent, grader)}
                          disableFillHandle={!canManage}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/*
        「担当0人＝全員が担当」はここで一度だけ言う（03 の設問の担当と同じ）。
        学級に属さない生徒も、誰にも割り当てなければ全員の採点画面に出る
      */}
      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <h4 className="mb-2 font-medium">使い方:</h4>
        <ul className="ml-4 space-y-1">
          <li>
            •{" "}
            <strong>
              チェックが1つも無い生徒は、全員が採点できます（担当なし＝全員）
            </strong>
            。割り当ては採点画面に出る答案を絞るためのもので、割り当てを忘れても採点が止まることはありません
          </li>
          <li>
            •
            チェックを入れると、その先生の採点画面にはその生徒の答案だけが並びます。設問の担当（「3.
            領域情報」の採点担当）とあわせて、「自分の設問 ×
            自分の生徒」が並びます
          </li>
          <li>
            • 列見出しの「学級から」で、その学級の生徒をまとめて担当にできます。
            学級は受験生徒一覧と同じ（受験日の所属）で、後から所属が変わっても担当は変わりません
          </li>
          <li>
            •{" "}
            <strong>
              マスを選んでから右下角（フィルハンドル）をドラッグすると、続いた生徒へまとめて入れられます
            </strong>
          </li>
          <li>
            • <strong>変更は自動で保存されます</strong>（逐次保存）
          </li>
        </ul>
      </div>
    </div>
  )
}
