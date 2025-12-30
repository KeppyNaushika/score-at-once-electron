"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Table, TableBody } from "@/components/ui/table"
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableTableRow } from "@/components/projects/05-students/components/sortable-student-table/components/SortableTableRow"
import { TableFilters } from "@/components/projects/05-students/components/sortable-student-table/components/TableFilters"
import { TableHeaderRow } from "@/components/projects/05-students/components/sortable-student-table/components/TableHeaderRow"
import { DragOverlayContent } from "@/components/projects/05-students/components/sortable-student-table/components/DragOverlayContent"
import { useSortableStudentTable } from "@/components/projects/05-students/components/sortable-student-table/hooks/useSortableStudentTable"
import type { SortableStudentTableProps } from "@/components/projects/05-students/components/sortable-student-table/types/studentTableTypes"

export function SortableStudentTableContainer(
  props: SortableStudentTableProps
) {
  const {
    classes,
    selectedStudents,
    searchTerm,
    onSearchChange,
    selectedClassId,
    onClassChange,
    statusFilter,
    onStatusChange,
  } = props

  const {
    sortedStudents,
    activeStudent,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleStudentToggle,
    handleSelectAll,
    handleResetOrder,
    onStudentStatusUpdate,
  } = useSortableStudentTable(props)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">生徒一覧</CardTitle>
            <CardDescription>
              {sortedStudents.length}名の生徒が表示されています
              {selectedStudents.size > 0 &&
                ` • ${selectedStudents.size}名選択中`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetOrder}>
            並び順をリセット
          </Button>
        </div>

        <TableFilters
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          selectedClassId={selectedClassId}
          onClassChange={onClassChange}
          statusFilter={statusFilter}
          onStatusChange={onStatusChange}
          classes={classes}
        />
      </CardHeader>
      <CardContent>
        <div className="min-h-96 rounded-md border">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeaderRow
                sortedStudents={sortedStudents}
                selectedStudents={selectedStudents}
                onSelectAll={handleSelectAll}
              />
              <TableBody>
                <SortableContext
                  items={sortedStudents.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedStudents.map((student) => (
                    <SortableTableRow
                      key={student.id}
                      student={student}
                      isSelected={selectedStudents.has(student.id)}
                      onToggleSelection={(studentId) =>
                        handleStudentToggle(studentId)
                      }
                      onStatusUpdate={onStudentStatusUpdate}
                    />
                  ))}
                </SortableContext>
              </TableBody>
              <DragOverlay>
                <DragOverlayContent
                  activeStudent={activeStudent}
                  selectedStudents={selectedStudents}
                />
              </DragOverlay>
            </Table>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  )
}
