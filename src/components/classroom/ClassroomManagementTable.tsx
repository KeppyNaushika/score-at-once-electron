"use client"

import { Download, Edit, PlusCircle, Search, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import ClassroomModal from "@/components/classroom/ClassroomModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTableSort } from "@/hooks/useTableSort"
import { isCurrentMembership } from "@/lib/membership"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"

// ソート用の型
interface ClassroomSortable {
  id: string
  name: string
  classroomCode: string | null
  grade: number | null
  memberCount: number
  original: ClassroomWithMemberships
}

export default function ClassroomManagementTable() {
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<ClassroomWithMemberships[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false)
  const [classroomToEdit, setClassroomToEdit] =
    useState<ClassroomWithMemberships | null>(null)

  // Selection states
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(
    new Set()
  )
  const [isExporting, setIsExporting] = useState(false)

  // Data fetching
  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const fetchedClassrooms = await window.electronAPI.fetchClassrooms()
        setClassrooms(fetchedClassrooms || [])
      } catch (error) {
        console.error("Failed to fetch classrooms:", error)
      }
    }
    fetchClassrooms()
  }, [])

  // Filter classrooms
  const filteredClassrooms = useMemo(() => {
    return classrooms.filter((classroomItem) => {
      const matchesSearch = classroomItem.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
      const isVisible = classroomItem.isVisible !== false
      return matchesSearch && isVisible
    })
  }, [classrooms, searchTerm])

  // ソート用のデータ変換
  const sortableData = useMemo<ClassroomSortable[]>(() => {
    return filteredClassrooms.map((classroomItem) => ({
      id: classroomItem.id,
      name: classroomItem.name,
      classroomCode: classroomItem.classroomCode ?? null,
      grade: classroomItem.grade ?? null,
      memberCount: classroomItem.memberships.filter(isCurrentMembership).length,
      original: classroomItem,
    }))
  }, [filteredClassrooms])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "name", direction: "asc" },
  })

  // Selection handlers
  const filteredIds = useMemo(
    () => sortedData.map((row) => row.id),
    [sortedData]
  )

  const isAllSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedClassroomIds.has(id))

  const isSomeSelected =
    !isAllSelected && filteredIds.some((id) => selectedClassroomIds.has(id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const newSet = new Set(selectedClassroomIds)
      filteredIds.forEach((id) => newSet.delete(id))
      setSelectedClassroomIds(newSet)
    } else {
      const newSet = new Set(selectedClassroomIds)
      filteredIds.forEach((id) => newSet.add(id))
      setSelectedClassroomIds(newSet)
    }
  }

  const toggleSelectClassroom = (classroomId: string) => {
    const newSet = new Set(selectedClassroomIds)
    if (newSet.has(classroomId)) {
      newSet.delete(classroomId)
    } else {
      newSet.add(classroomId)
    }
    setSelectedClassroomIds(newSet)
  }

  // Event handlers
  const handleAddNewClassroom = () => {
    setClassroomToEdit(null)
    setIsClassroomModalOpen(true)
  }

  const handleEditClassroom = (classroomItem: ClassroomWithMemberships) => {
    setClassroomToEdit(classroomItem)
    setIsClassroomModalOpen(true)
  }

  const handleDeleteClassroom = async (classroomId: string) => {
    if (window.confirm("本当にこの学級を削除しますか？")) {
      try {
        await window.electronAPI.deleteClassroom(classroomId)
        setClassrooms(
          classrooms.filter((classroom) => classroom.id !== classroomId)
        )
        setSelectedClassroomIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(classroomId)
          return newSet
        })
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  const handleSaveClassroom = async (classroomData: {
    name: string
    classroomCode?: string
    grade?: number
    description?: string
    isVisible?: boolean
  }) => {
    try {
      if (classroomToEdit) {
        const updatedClassroom = await window.electronAPI.updateClassroom({
          id: classroomToEdit.id,
          ...classroomData,
        })
        setClassrooms(
          classrooms.map((classroom) =>
            classroom.id === updatedClassroom.id ? updatedClassroom : classroom
          )
        )
      } else {
        const newClassroom =
          await window.electronAPI.createClassroom(classroomData)
        setClassrooms([...classrooms, newClassroom])
      }
      setIsClassroomModalOpen(false)
    } catch (error) {
      console.error("Failed to save class:", error)
      alert("学級の保存に失敗しました。")
    }
  }

  const handleExportExcel = async () => {
    if (selectedClassroomIds.size === 0) return
    setIsExporting(true)
    try {
      const result = await window.electronAPI.exportClassroomsExcel(
        Array.from(selectedClassroomIds)
      )
      if (result.success) {
        toast.success(
          `${selectedClassroomIds.size}学級のデータをExcelに出力しました`
        )
      } else if (result.error !== "出力がキャンセルされました") {
        toast.error(`エクスポートに失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error("Failed to export classrooms:", error)
      toast.error("エクスポート中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      {/* Action Bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleAddNewClassroom}
            variant="outline"
            className="rounded-lg"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            学級追加
          </Button>
          {selectedClassroomIds.size > 0 && (
            <>
              <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                {selectedClassroomIds.size}学級選択中
              </span>
              <Button
                onClick={handleExportExcel}
                variant="outline"
                className="rounded-lg"
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "出力中..." : "Excel出力"}
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="学級名で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-56 rounded-lg pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {sortedData.length}学級
          </span>
        </div>
      </div>

      {/* Classes Table */}
      <div className="min-h-0 flex-1 p-4">
        <div className="h-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
          <Table wrapperClassName="h-full">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      isAllSelected
                        ? true
                        : isSomeSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="全選択"
                  />
                </TableHead>
                <SortableTableHead
                  sortKey="name"
                  currentSortKey={sortConfig.key}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key)}
                >
                  学級名
                </SortableTableHead>
                <SortableTableHead
                  sortKey="classroomCode"
                  currentSortKey={sortConfig.key}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key)}
                >
                  コード
                </SortableTableHead>
                <SortableTableHead
                  sortKey="grade"
                  currentSortKey={sortConfig.key}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key)}
                >
                  学年
                </SortableTableHead>
                <TableHead>説明</TableHead>
                <SortableTableHead
                  sortKey="memberCount"
                  currentSortKey={sortConfig.key}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key)}
                >
                  所属数
                </SortableTableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map(({ original: classroomItem, memberCount }) => {
                const isSelected = selectedClassroomIds.has(classroomItem.id)

                return (
                  <TableRow
                    key={classroomItem.id}
                    onClick={() =>
                      router.push(`/classrooms/${classroomItem.id}`)
                    }
                    className="group cursor-pointer"
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell
                      className="w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          toggleSelectClassroom(classroomItem.id)
                        }
                        aria-label={`${classroomItem.name}を選択`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {classroomItem.name}
                    </TableCell>
                    <TableCell>
                      {classroomItem.classroomCode ? (
                        <Badge
                          variant="outline"
                          className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                        >
                          {classroomItem.classroomCode}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {classroomItem.grade || (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {classroomItem.description ? (
                        <span className="max-w-xs truncate text-sm">
                          {classroomItem.description}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {memberCount}名
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditClassroom(classroomItem)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClassroom(classroomItem.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    該当する学級が見つかりません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modals */}
      {isClassroomModalOpen && (
        <ClassroomModal
          isOpen={isClassroomModalOpen}
          onClose={() => setIsClassroomModalOpen(false)}
          onSave={handleSaveClassroom}
          classroomToEdit={classroomToEdit}
        />
      )}
    </div>
  )
}
