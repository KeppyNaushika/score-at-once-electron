"use client"

import { UserPlus } from "lucide-react"
import { useMemo } from "react"

import {
  type AvailableClassOption,
  type ClassRosterEntry,
  type ClassRosterFlagColumn,
  ClassRosterManager,
} from "@/components/common/class-roster"
import type { ExamClassWithClass } from "@/types/electron/examClassApi"

interface ClassExamManagerProps {
  examId: string
  examClasses: ExamClassWithClass[]
  onRemoveClass: (examClassId: string) => Promise<boolean>
  onUpdateClass: (
    examClassId: string,
    options: { administered?: boolean }
  ) => Promise<unknown>
  onClassesChanged?: () => void
  showAddDialog?: boolean
  onShowAddDialogChange?: (open: boolean) => void
}

/**
 * 試験-学級関連の管理コンポーネント
 *
 * 共通 {@link ClassRosterManager} を試験向けに構成する薄いラッパー。
 * 試験は「再採番(administered)」フラグ列を持ち、削除は登録解除のみ（生徒は受験者に残す）。
 * ※生徒の追加は「生徒を追加」モーダルで行う。
 */
export function ClassExamManager({
  examId,
  examClasses,
  onRemoveClass,
  onUpdateClass,
  onClassesChanged,
  showAddDialog,
  onShowAddDialogChange,
}: ClassExamManagerProps) {
  const entries = useMemo<ClassRosterEntry[]>(
    () =>
      examClasses.map((ec) => ({
        id: ec.id,
        classId: ec.classId,
        name: ec.class.name,
        classCode: ec.class.classCode,
        grade: ec.class.grade,
        studentCount: ec.class.memberships.length,
        order: ec.order,
      })),
    [examClasses]
  )

  // examClassId → administered の参照（行ごとの線形検索を避ける）
  const administeredById = useMemo(
    () => new Map(examClasses.map((ec) => [ec.id, ec.administered])),
    [examClasses]
  )

  const administeredCount = examClasses.filter((ec) => ec.administered).length

  const flagColumns = useMemo<ClassRosterFlagColumn[]>(
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
          await onUpdateClass(entry.id, { administered: checked })
        },
      },
    ],
    [administeredById, onUpdateClass]
  )

  return (
    <ClassRosterManager
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
      fetchAvailableClasses={async () => {
        const classes = await window.electronAPI.examClass.getAvailable(examId)
        return classes.map((c): AvailableClassOption => ({
          id: c.id,
          name: c.name,
          classCode: c.classCode,
          grade: c.grade,
          studentCount: c.studentCount,
        }))
      }}
      onAddClasses={async (classIds) => {
        for (const classId of classIds) {
          // administered の学級は既定で教員集計・生徒表示の対象（移行の
          // studentReport=administered と整合）。出力スコープは後から08で調整可能。
          await window.electronAPI.examClass.add({
            examId,
            classId,
            administered: true,
            teacherStat: true,
            studentReport: true,
          })
        }
      }}
      onReorder={async (orderedIds) => {
        await window.electronAPI.examClass.reorder({ examId, orderedIds })
      }}
      onRemove={async (entry) => {
        await onRemoveClass(entry.id)
      }}
      onChanged={onClassesChanged}
      showAddDialog={showAddDialog}
      onShowAddDialogChange={onShowAddDialogChange}
    />
  )
}
