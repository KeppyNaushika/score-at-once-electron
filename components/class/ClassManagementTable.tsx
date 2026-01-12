"use client"

import { Edit, PlusCircle, Search, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import ClassModal from "@/components/class/ClassModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  subject?: string | null
  isVisible?: boolean
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    subject?: string | null
    notes?: string | null
    attendanceNumber?: number | null
    student: {
      id: string
      studentId: string
      lastName: string
      firstName: string
      lastNameKana: string
      firstNameKana: string
    }
  }>
}

// ソート用の型
interface ClassSortable {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  memberCount: number
  original: ClassWithMemberships
}

export default function ClassManagementTable() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<ClassWithMemberships | null>(
    null
  )

  // Data fetching
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const fetchedClasses = await window.electronAPI.fetchClasses()
        setClasses(fetchedClasses || [])
      } catch (error) {
        console.error("Failed to fetch classes:", error)
      }
    }
    fetchClasses()
  }, [])

  // Filter classes
  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      const matchesSearch = classItem.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
      const isVisible = classItem.isVisible !== false
      return matchesSearch && isVisible
    })
  }, [classes, searchTerm])

  // ソート用のデータ変換
  const sortableData = useMemo<ClassSortable[]>(() => {
    return filteredClasses.map((classItem) => ({
      id: classItem.id,
      name: classItem.name,
      classCode: classItem.classCode ?? null,
      grade: classItem.grade ?? null,
      memberCount: classItem.memberships.length,
      original: classItem,
    }))
  }, [filteredClasses])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "name", direction: "asc" },
  })

  // Event handlers
  const handleAddNewClass = () => {
    setClassToEdit(null)
    setIsClassModalOpen(true)
  }

  const handleEditClass = (classItem: ClassWithMemberships) => {
    setClassToEdit(classItem)
    setIsClassModalOpen(true)
  }

  const handleDeleteClass = async (classId: string) => {
    if (window.confirm("本当にこの学級を削除しますか？")) {
      try {
        await window.electronAPI.deleteClass(classId)
        setClasses(classes.filter((c) => c.id !== classId))
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  const handleSaveClass = async (classData: {
    name: string
    classCode?: string
    grade?: number
    description?: string
    isVisible?: boolean
  }) => {
    try {
      if (classToEdit) {
        const updatedClass = await window.electronAPI.updateClass({
          id: classToEdit.id,
          ...classData,
        })
        setClasses(
          classes.map((c) => (c.id === updatedClass.id ? updatedClass : c))
        )
      } else {
        const newClass = await window.electronAPI.createClass(classData)
        setClasses([...classes, newClass])
      }
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to save class:", error)
      alert("学級の保存に失敗しました。")
    }
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="border-border/50 bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              placeholder="学級名で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border/50 bg-muted/20 focus:bg-background h-9 w-64 rounded-lg transition-colors"
            />
          </div>
          <span className="text-muted-foreground text-sm tabular-nums">
            {sortedData.length}学級
          </span>
        </div>
        <Button onClick={handleAddNewClass} className="rounded-lg">
          <PlusCircle className="mr-2 h-4 w-4" />
          学級追加
        </Button>
      </div>

      {/* Classes Table */}
      <div className="border-border/50 bg-card min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted/40">
                <SortableTableHead
                  sortKey="name"
                  currentSortKey={sortConfig.key as string | null}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key as keyof ClassSortable)}
                >
                  学級名
                </SortableTableHead>
                <SortableTableHead
                  sortKey="classCode"
                  currentSortKey={sortConfig.key as string | null}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key as keyof ClassSortable)}
                >
                  コード
                </SortableTableHead>
                <SortableTableHead
                  sortKey="grade"
                  currentSortKey={sortConfig.key as string | null}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key as keyof ClassSortable)}
                >
                  学年
                </SortableTableHead>
                <TableHead>説明</TableHead>
                <SortableTableHead
                  sortKey="memberCount"
                  currentSortKey={sortConfig.key as string | null}
                  currentDirection={sortConfig.direction}
                  onSort={(key) => requestSort(key as keyof ClassSortable)}
                >
                  所属数
                </SortableTableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map(({ original: classItem, memberCount }) => {
                return (
                  <TableRow
                    key={classItem.id}
                    onClick={() => router.push(`/classes/${classItem.id}`)}
                    className="group cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      {classItem.name}
                    </TableCell>
                    <TableCell>
                      {classItem.classCode ? (
                        <Badge
                          variant="outline"
                          className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                        >
                          {classItem.classCode}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {classItem.grade || (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {classItem.description ? (
                        <span className="max-w-xs truncate text-sm">
                          {classItem.description}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
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
                          className="hover:bg-muted h-8 w-8 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditClass(classItem)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClass(classItem.id)
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
                    colSpan={6}
                    className="text-muted-foreground h-32 text-center"
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
      {isClassModalOpen && (
        <ClassModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          onSave={handleSaveClass}
          classToEdit={classToEdit}
        />
      )}
    </div>
  )
}
