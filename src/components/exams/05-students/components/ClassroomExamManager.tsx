"use client"

import { UserPlus } from "lucide-react"
import { useMemo } from "react"

import {
  type AvailableClassroomOption,
  type ClassroomRosterEntry,
  type ClassroomRosterFlagColumn,
  ClassroomRosterManager,
} from "@/components/common/classroom-roster"
import type { ExamClassroomWithMemberships } from "@/types/electron/examClassroomApi"

interface ClassroomExamManagerProps {
  examId: string
  examClassrooms: ExamClassroomWithMemberships[]
  onRemoveClassroom: (examClassroomId: string) => Promise<boolean>
  onUpdateClassroom: (
    examClassroomId: string,
    options: { administered?: boolean }
  ) => Promise<unknown>
  onClassroomsChanged?: () => void
  showAddDialog?: boolean
  onShowAddDialogChange?: (open: boolean) => void
}

/**
 * 試験-学級関連の管理コンポーネント
 *
 * 共通 {@link ClassroomRosterManager} を試験向けに構成する薄いラッパー。
 * 試験は「再採番(administered)」フラグ列を持ち、削除は登録解除のみ（生徒は受験者に残す）。
 * ※生徒の追加は「生徒を追加」モーダルで行う。
 */
export function ClassroomExamManager({
  examId,
  examClassrooms,
  onRemoveClassroom,
  onUpdateClassroom,
  onClassroomsChanged,
  showAddDialog,
  onShowAddDialogChange,
}: ClassroomExamManagerProps) {
  const entries = useMemo<ClassroomRosterEntry[]>(
    () =>
      examClassrooms.map((examClassroom) => ({
        id: examClassroom.id,
        classroomId: examClassroom.classroomId,
        name: examClassroom.classroom.name,
        classroomCode: examClassroom.classroom.classroomCode,
        grade: examClassroom.classroom.grade,
        studentCount: examClassroom.classroom.memberships.length,
        order: examClassroom.order,
      })),
    [examClassrooms]
  )

  // examClassroomId → administered の参照（行ごとの線形検索を避ける）
  const administeredById = useMemo(
    () =>
      new Map(
        examClassrooms.map((examClassroom) => [
          examClassroom.id,
          examClassroom.administered,
        ])
      ),
    [examClassrooms]
  )

  const administeredCount = examClassrooms.filter(
    (examClassroom) => examClassroom.administered
  ).length

  const flagColumns = useMemo<ClassroomRosterFlagColumn[]>(
    () => [
      {
        key: "administered",
        header: (
          <div className="flex items-center justify-center gap-1">
            <UserPlus className="h-4 w-4" />
            <span>再採番</span>
          </div>
        ),
        checked: (entry) => administeredById.get(entry.id) ?? false,
        onChange: async (entry, checked) => {
          await onUpdateClassroom(entry.id, { administered: checked })
        },
      },
    ],
    [administeredById, onUpdateClassroom]
  )

  return (
    <ClassroomRosterManager
      entries={entries}
      flagColumns={flagColumns}
      removalMode="unlink-only"
      description={
        <>
          再採番（並べ替え・出席番号）の対象クラスを管理します。生徒の追加は「生徒を追加」から行います。
          {entries.length > 0 && <> • 再採番対象: {administeredCount}クラス</>}
        </>
      }
      emptyHint="「学級を追加」ボタンから学級を追加してください"
      fetchAvailableClassrooms={async () => {
        const classrooms =
          await window.electronAPI.examClassroom.getAvailable(examId)
        return classrooms.map((classroom): AvailableClassroomOption => ({
          id: classroom.id,
          name: classroom.name,
          classroomCode: classroom.classroomCode,
          grade: classroom.grade,
          studentCount: classroom.studentCount,
        }))
      }}
      onAddClassrooms={async (classroomIds) => {
        for (const classroomId of classroomIds) {
          // administered の学級は既定で教員集計・生徒表示の対象（移行の
          // studentReport=administered と整合）。出力スコープは後から08で調整可能。
          await window.electronAPI.examClassroom.add({
            examId,
            classroomId,
            administered: true,
            teacherStatistics: true,
            studentReport: true,
          })
        }
      }}
      onReorder={async (orderedIds) => {
        await window.electronAPI.examClassroom.reorder({ examId, orderedIds })
      }}
      onRemove={async (entry) => {
        await onRemoveClassroom(entry.id)
      }}
      onChanged={onClassroomsChanged}
      showAddDialog={showAddDialog}
      onShowAddDialogChange={onShowAddDialogChange}
    />
  )
}
