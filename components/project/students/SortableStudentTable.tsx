"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  KeyboardSensor,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, UserCheck, Users, UserX } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

// 生徒の状態を表す型
type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型
interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: {
    id: string
    attendanceNumber?: number | null
    class: {
      id: string
      name: string
    }
  }[]
  status: StudentStatus
  isInProject: boolean
  customOrder?: number | null
}

// クラスデータの型
interface ClassGroup {
  id: string
  name: string
  students: Student[]
}

interface SortableStudentTableProps {
  classes: ClassGroup[]
  onStudentStatusUpdate: (studentId: string, status: StudentStatus) => Promise<void>
  onStudentOrderUpdate: (projectId: string, studentOrders: { studentId: string; customOrder: number }[]) => Promise<void>
  selectedStudents: Set<string>
  onStudentSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  filteredStudents: Student[]
  projectId: string
}

// ドラッグ可能な行コンポーネント
function SortableTableRow({
  student,
  isSelected,
  onToggleSelection,
  onStatusUpdate,
  isDragging,
}: {
  student: Student
  isSelected: boolean
  onToggleSelection: (studentId: string, event?: React.MouseEvent) => void
  onStatusUpdate: (studentId: string, status: StudentStatus) => void
  isDragging?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: student.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  const statusConfig = getStatusConfig(student.status)
  const StatusIcon = statusConfig.icon

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${isSortableDragging ? "bg-muted/50" : ""} ${isDragging ? "shadow-lg" : ""} cursor-pointer`}
      onClick={(event) => {
        if (!event.defaultPrevented) {
          onToggleSelection(student.id, event)
        }
      }}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-muted"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked, event) => {
              event?.stopPropagation()
              onToggleSelection(student.id)
            }}
          />
        </div>
      </TableCell>
      <TableCell className="font-medium text-center">
        {student.memberships[0]?.attendanceNumber || "-"}
      </TableCell>
      <TableCell className="font-mono">
        {student.studentId}
      </TableCell>
      <TableCell className="font-medium">
        {student.lastName} {student.firstName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {student.lastNameKana} {student.firstNameKana}
      </TableCell>
      <TableCell>
        {student.memberships[0]?.class.name || "未所属"}
      </TableCell>
      <TableCell>
        <Badge variant={statusConfig.variant} className="gap-1">
          <StatusIcon className="h-3 w-3" />
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={student.status === "participating" ? "default" : "outline"}
            onClick={() => onStatusUpdate(student.id, "participating")}
          >
            受験
          </Button>
          <Button
            size="sm"
            variant={student.status === "expected" ? "secondary" : "outline"}
            onClick={() => onStatusUpdate(student.id, "expected")}
          >
            見込
          </Button>
          <Button
            size="sm"
            variant={student.status === "absent" ? "destructive" : "outline"}
            onClick={() => onStatusUpdate(student.id, "absent")}
          >
            欠席
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// 状態のラベルとスタイル
function getStatusConfig(status: StudentStatus) {
  switch (status) {
    case "participating":
      return { label: "受験", variant: "default" as const, icon: UserCheck }
    case "expected":
      return { label: "見込", variant: "secondary" as const, icon: Users }
    case "absent":
      return { label: "欠席", variant: "destructive" as const, icon: UserX }
  }
}

export default function SortableStudentTable({
  classes,
  onStudentStatusUpdate,
  onStudentOrderUpdate,
  selectedStudents,
  onStudentSelectionChange,
  onSelectAll,
  filteredStudents,
  projectId,
}: SortableStudentTableProps) {
  const [sortedStudents, setSortedStudents] = useState<Student[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // センサーの設定（マウスとキーボード対応）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動したらドラッグ開始
      },
    }),
    useSensor(KeyboardSensor)
  )

  // 生徒の並び順を初期化・更新
  useEffect(() => {
    // まず学級順→出席番号順でソート
    const classMap = new Map<string, ClassGroup>()
    classes.forEach(cls => classMap.set(cls.id, cls))

    const defaultSorted = filteredStudents.slice().sort((a, b) => {
      const aClass = a.memberships[0]?.class.name || ""
      const bClass = b.memberships[0]?.class.name || ""
      const aAttendance = a.memberships[0]?.attendanceNumber || 99999
      const bAttendance = b.memberships[0]?.attendanceNumber || 99999

      // 学級名でソート
      if (aClass !== bClass) {
        return aClass.localeCompare(bClass)
      }

      // 同じ学級内では出席番号でソート
      return aAttendance - bAttendance
    })

    // カスタムオーダーがある場合はそれを優先
    const withCustomOrder = defaultSorted.slice().sort((a, b) => {
      // カスタムオーダーが両方ある場合
      if (a.customOrder !== null && a.customOrder !== undefined &&
          b.customOrder !== null && b.customOrder !== undefined) {
        return a.customOrder - b.customOrder
      }

      // aにのみカスタムオーダーがある場合
      if (a.customOrder !== null && a.customOrder !== undefined) {
        return -1
      }

      // bにのみカスタムオーダーがある場合
      if (b.customOrder !== null && b.customOrder !== undefined) {
        return 1
      }

      // 両方カスタムオーダーがない場合はデフォルトの順序を維持
      return 0
    })

    setSortedStudents(withCustomOrder)
  }, [filteredStudents, classes])

  // ドラッグ開始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // ドラッグ終了
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = sortedStudents.findIndex(student => student.id === active.id)
    const newIndex = sortedStudents.findIndex(student => student.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // 選択されている生徒を取得
    const selectedStudentsList = sortedStudents.filter(student =>
      selectedStudents.has(student.id)
    )

    // ドラッグされた生徒が選択されている場合は、選択されたすべての生徒を一緒に移動
    if (selectedStudents.has(active.id as string) && selectedStudentsList.length > 1) {
      // 複数選択の場合の処理
      const newSortedStudents = [...sortedStudents]

      // 選択されている生徒を元の位置から削除
      const selectedStudentsData = selectedStudentsList.map(student => {
        const index = newSortedStudents.findIndex(s => s.id === student.id)
        return newSortedStudents.splice(index, 1)[0]
      }).filter(Boolean)

      // 新しい位置に挿入
      const targetIndex = newIndex <= oldIndex ? newIndex : newIndex - selectedStudentsList.length + 1
      newSortedStudents.splice(targetIndex, 0, ...selectedStudentsData)

      setSortedStudents(newSortedStudents)

      // カスタムオーダーを更新
      const studentOrders = newSortedStudents.map((student, index) => ({
        studentId: student.id,
        customOrder: index,
      }))

      await onStudentOrderUpdate(projectId, studentOrders)
    } else {
      // 単一選択の場合の処理
      const newSortedStudents = arrayMove(sortedStudents, oldIndex, newIndex)
      setSortedStudents(newSortedStudents)

      // カスタムオーダーを更新
      const studentOrders = newSortedStudents.map((student, index) => ({
        studentId: student.id,
        customOrder: index,
      }))

      await onStudentOrderUpdate(projectId, studentOrders)
    }
  }, [sortedStudents, selectedStudents, onStudentOrderUpdate, projectId])

  // チェックボックスのトグル（Shiftキー対応）
  const handleStudentToggle = useCallback((studentId: string, event?: React.MouseEvent) => {
    const currentIndex = sortedStudents.findIndex(s => s.id === studentId)

    if (event?.shiftKey && lastSelectedIndex !== null && currentIndex !== -1) {
      // Shift+クリックの場合は範囲選択
      const start = Math.min(lastSelectedIndex, currentIndex)
      const end = Math.max(lastSelectedIndex, currentIndex)

      const isCurrentSelected = selectedStudents.has(studentId)

      for (let i = start; i <= end; i++) {
        const student = sortedStudents[i]
        if (student) {
          onStudentSelectionChange(student.id, !isCurrentSelected)
        }
      }
    } else {
      // 通常のクリック
      const isSelected = selectedStudents.has(studentId)
      onStudentSelectionChange(studentId, !isSelected)
      setLastSelectedIndex(currentIndex)
    }
  }, [sortedStudents, selectedStudents, onStudentSelectionChange, lastSelectedIndex])

  // 全選択のトグル
  const handleSelectAll = useCallback((checked: boolean) => {
    onSelectAll(checked)
    setLastSelectedIndex(null)
  }, [onSelectAll])

  // リセットボタン（デフォルトの並び順に戻す）
  const handleResetOrder = useCallback(async () => {
    // customOrderをすべてnullにリセット
    const studentOrders = sortedStudents.map(student => ({
      studentId: student.id,
      customOrder: 0, // 一時的に0を設定
    }))

    // データベースを更新してからリロード
    await onStudentOrderUpdate(projectId, studentOrders)

    // その後、customOrderをnullにするため、負の値で再更新
    const resetOrders = sortedStudents.map(student => ({
      studentId: student.id,
      customOrder: -1, // 負の値でリセットの合図
    }))

    await onStudentOrderUpdate(projectId, resetOrders)
  }, [sortedStudents, onStudentOrderUpdate, projectId])

  const activeStudent = activeId ? sortedStudents.find(s => s.id === activeId) : null

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">生徒一覧</CardTitle>
            <CardDescription>
              {sortedStudents.length}名の生徒が表示されています
              {selectedStudents.size > 0 && ` • ${selectedStudents.size}名選択中`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetOrder}
          >
            並び順をリセット
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Checkbox
                        checked={
                          sortedStudents.length > 0 &&
                          sortedStudents.every(s => selectedStudents.has(s.id))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px]">出席番号</TableHead>
                  <TableHead className="w-[100px]">学籍番号</TableHead>
                  <TableHead>氏名</TableHead>
                  <TableHead>ふりがな</TableHead>
                  <TableHead>学級</TableHead>
                  <TableHead>受験状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={sortedStudents.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedStudents.map((student) => (
                    <SortableTableRow
                      key={student.id}
                      student={student}
                      isSelected={selectedStudents.has(student.id)}
                      onToggleSelection={(studentId) => handleStudentToggle(studentId)}
                      onStatusUpdate={onStudentStatusUpdate}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>

            <DragOverlay>
              {activeStudent ? (
                <div className="bg-background rounded-md border p-2 shadow-lg">
                  <div className="font-medium">
                    {activeStudent.lastName} {activeStudent.firstName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activeStudent.memberships[0]?.class.name}
                    {selectedStudents.size > 1 && ` (+${selectedStudents.size - 1}名)`}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  )
}
