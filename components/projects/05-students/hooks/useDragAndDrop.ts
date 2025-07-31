import type { Student } from "@/components/projects/05-students/types"
import {
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useState } from "react"

interface UseDragAndDropProps {
  students: Student[]
  setStudents: (students: Student[]) => void
  projectId: string
  onStudentOrderUpdate: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[],
  ) => Promise<void>
}

export const useDragAndDrop = ({
  students,
  setStudents,
  projectId,
  onStudentOrderUpdate,
}: UseDragAndDropProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    const student = students.find((s) => s.id === active.id)
    setDraggedStudent(student || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setDraggedStudent(null)

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = students.findIndex((student) => student.id === active.id)
    const newIndex = students.findIndex((student) => student.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newStudents = arrayMove(students, oldIndex, newIndex)
      setStudents(newStudents)

      const updatedOrders = newStudents.map((student, index) => ({
        studentId: student.id,
        customOrder: index + 1,
      }))

      try {
        await onStudentOrderUpdate(projectId, updatedOrders)
      } catch (error) {
        console.error("Failed to update student order:", error)
        setStudents(students)
      }
    }
  }

  return {
    sensors,
    activeId,
    draggedStudent,
    handleDragStart,
    handleDragEnd,
    collisionDetection: closestCenter,
  }
}
