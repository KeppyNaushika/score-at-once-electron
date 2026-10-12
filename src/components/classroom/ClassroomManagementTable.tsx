"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Download, Plus, School } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import ClassroomModal from "@/components/classroom/ClassroomModal"
import ConfirmationModal from "@/components/common/ConfirmationModal"
import { ListSearchInput } from "@/components/common/ListFilterControls"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import { SelectableListTable } from "@/components/common/SelectableListTable"
import type { ColumnHeadDefinition } from "@/components/common/SortableColumnHeads"
import PageHeader from "@/components/layout/PageHeader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { useRowSelection } from "@/hooks/useRowSelection"
import { useTableSort } from "@/hooks/useTableSort"
import { isCurrentMembership } from "@/lib/membership"
import { matchesSearchTerm } from "@/lib/searchText"
import {
  classroomListQuery,
  createClassroomMutation,
  deleteClassroomMutation,
  exportClassroomsExcelMutation,
  updateClassroomMutation,
} from "@/queries/student"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"
import { isOneOf } from "@/types/stringUnion"

import { ClassroomManagementRow } from "./ClassroomManagementRow"

// ソート用の型
interface ClassroomSortable {
  id: string
  name: string
  classroomCode: string | null
  grade: number | null
  memberCount: number
  original: ClassroomWithMemberships
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: ClassroomWithMemberships[] = []

/** 表示設定での絞り込み。非表示の学級も一覧から開いて表示に戻せるようにする */
const VISIBILITY_FILTERS = ["visible", "hidden", "all"] as const
type VisibilityFilter = (typeof VISIBILITY_FILTERS)[number]

/** 先頭のチェックボックス列より後ろの見出し */
const CLASSROOM_COLUMNS: ColumnHeadDefinition<keyof ClassroomSortable>[] = [
  { label: "学級名", sortKey: "name" },
  { label: "学級コード", sortKey: "classroomCode" },
  { label: "学年", sortKey: "grade" },
  { label: "説明" },
  { label: "在籍数", sortKey: "memberCount" },
  { label: "操作", className: "text-right" },
]

export default function ClassroomManagementTable() {
  const router = useRouter()
  // 学級は全画面で共有するキャッシュから引く（この画面だけ取り直さない）
  const { data: classrooms = EMPTY_CLASSROOMS } = useQuery(classroomListQuery())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterVisibility, setFilterVisibility] =
    useState<VisibilityFilter>("visible")
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false)
  const [classroomToEdit, setClassroomToEdit] =
    useState<ClassroomWithMemberships | null>(null)
  const classroomDeletion = useDialogTarget<ClassroomWithMemberships>()

  // Filter classrooms
  const filteredClassrooms = useMemo(() => {
    return classrooms.filter((classroomItem) => {
      const matchesSearch = matchesSearchTerm(searchTerm, [classroomItem.name])
      const isVisible = classroomItem.isVisible !== false
      const matchesVisibility =
        filterVisibility === "all" ||
        (filterVisibility === "visible" ? isVisible : !isVisible)
      return matchesSearch && matchesVisibility
    })
  }, [classrooms, searchTerm, filterVisibility])

  // ソート用のデータ変換
  const sortableData = useMemo<ClassroomSortable[]>(() => {
    return filteredClassrooms.map((classroomItem) => ({
      id: classroomItem.id,
      name: classroomItem.name,
      classroomCode: classroomItem.classroomCode ?? null,
      grade: classroomItem.grade ?? null,
      // 今日在籍している人数。在籍予定（新年度に向けて前もって組んだ所属）は数えない
      memberCount: classroomItem.memberships.filter((membership) =>
        isCurrentMembership(membership)
      ).length,
      original: classroomItem,
    }))
  }, [filteredClassrooms])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "name", direction: "asc" },
  })

  // 絞り込みと並び順を変えたら先頭のページから見る
  const paginationResetKey = [
    searchTerm,
    filterVisibility,
    sortConfig.key ?? "",
    sortConfig.direction ?? "",
  ].join("|")

  // 全選択・全解除は、表示中のものだけを対象にする
  const {
    selectedIds: selectedClassroomIds,
    toggleSelect: setClassroomSelected,
    toggleSelectAll,
    allSelected: isAllSelected,
  } = useRowSelection(sortedData)

  const isSomeSelected =
    !isAllSelected && sortedData.some((row) => selectedClassroomIds.has(row.id))

  const createClassroom = useMutation(createClassroomMutation())
  const updateClassroom = useMutation(updateClassroomMutation())
  const deleteClassroom = useMutation(deleteClassroomMutation())
  const exportClassroomsExcel = useMutation(exportClassroomsExcelMutation())

  // Event handlers
  const handleAddNewClassroom = () => {
    setClassroomToEdit(null)
    setIsClassroomModalOpen(true)
  }

  const handleEditClassroom = (classroomItem: ClassroomWithMemberships) => {
    setClassroomToEdit(classroomItem)
    setIsClassroomModalOpen(true)
  }

  const handleConfirmDeleteClassroom = () => {
    if (classroomDeletion.target === null) return
    const classroomId = classroomDeletion.target.id
    classroomDeletion.close()
    deleteClassroom.mutate(classroomId, {
      onSuccess: () => setClassroomSelected(classroomId, false),
    })
  }

  const handleSaveClassroom = (classroomData: {
    name: string
    classroomCode?: string
    grade?: number
    description?: string
    isVisible?: boolean
  }) => {
    const closeModal = { onSuccess: () => setIsClassroomModalOpen(false) }
    if (classroomToEdit) {
      updateClassroom.mutate(
        { id: classroomToEdit.id, ...classroomData },
        closeModal
      )
      return
    }
    createClassroom.mutate(classroomData, closeModal)
  }

  const handleExportExcel = () => {
    if (selectedClassroomIds.size === 0) return
    exportClassroomsExcel.mutate(Array.from(selectedClassroomIds), {
      onSuccess: (result) => {
        if (result.canceled) return
        toast.success(
          `${selectedClassroomIds.size}学級のデータをExcelに出力しました`
        )
      },
    })
  }

  const visibilityFilter = (
    <Select
      value={filterVisibility}
      onValueChange={(value) => {
        if (isOneOf(VISIBILITY_FILTERS, value)) setFilterVisibility(value)
      }}
    >
      <SelectTrigger size="sm" className="w-36 rounded-lg">
        <SelectValue placeholder="表示設定" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="visible">表示中の学級</SelectItem>
        <SelectItem value="hidden">非表示の学級</SelectItem>
        <SelectItem value="all">すべて</SelectItem>
      </SelectContent>
    </Select>
  )

  const toolbarActions: ToolbarAction[] = [
    {
      id: "search",
      priority: 90,
      node: (
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          placeholder="学級名で検索"
          className="w-56"
        />
      ),
      collapsedNode: (
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          placeholder="学級名で検索"
          className="w-full"
        />
      ),
    },
    {
      id: "visibility-filter",
      priority: 85,
      node: visibilityFilter,
      collapsedNode: visibilityFilter,
    },
    toolbarButtonAction({
      id: "create",
      priority: 80,
      icon: Plus,
      label: "学級追加",
      onClick: handleAddNewClassroom,
    }),
  ]
  if (selectedClassroomIds.size > 0) {
    // 選択中だけ現れる操作。幅が急に増えるが、畳みは実測なので自然に吸収される
    toolbarActions.push(
      toolbarButtonAction({
        id: "excel-export",
        priority: 50,
        icon: Download,
        label: exportClassroomsExcel.isPending
          ? "出力中..."
          : `Excel出力（${selectedClassroomIds.size}学級）`,
        onClick: handleExportExcel,
        disabled: exportClassroomsExcel.isPending,
      })
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      <PageHeader
        title="学級管理"
        subtitle={`${sortedData.length}学級`}
        actions={toolbarActions}
      />

      <SelectableListTable
        rows={sortedData}
        renderRow={({ original: classroomItem, memberCount }) => (
          <ClassroomManagementRow
            key={classroomItem.id}
            classroom={classroomItem}
            memberCount={memberCount}
            isSelected={selectedClassroomIds.has(classroomItem.id)}
            onOpen={() => router.push(`/classrooms/${classroomItem.id}`)}
            onToggleSelect={() =>
              setClassroomSelected(
                classroomItem.id,
                !selectedClassroomIds.has(classroomItem.id)
              )
            }
            onEdit={() => handleEditClassroom(classroomItem)}
            onDelete={() => classroomDeletion.openWith(classroomItem)}
          />
        )}
        columns={CLASSROOM_COLUMNS}
        currentSortKey={sortConfig.key}
        currentDirection={sortConfig.direction}
        onSort={requestSort}
        allSelected={isAllSelected}
        someSelected={isSomeSelected}
        onToggleSelectAll={toggleSelectAll}
        paginationResetKey={paginationResetKey}
        emptyIcon={School}
        emptyMessage="該当する学級が見つかりません"
      />

      {/* Modals */}
      {isClassroomModalOpen && (
        <ClassroomModal
          isOpen={isClassroomModalOpen}
          onClose={() => setIsClassroomModalOpen(false)}
          onSave={handleSaveClassroom}
          classroomToEdit={classroomToEdit}
        />
      )}

      <ConfirmationModal
        open={classroomDeletion.isOpen}
        onClose={classroomDeletion.close}
        title="本当にこの学級を削除しますか？"
        confirmText="削除"
        variant="destructive"
        icon="trash"
        onConfirm={handleConfirmDeleteClassroom}
      />
    </div>
  )
}
