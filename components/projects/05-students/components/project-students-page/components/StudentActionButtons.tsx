"use client"

import { Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"

interface StudentActionButtonsProps {
  selectedStudentsCount: number
  onRemoveStudents: () => void
  onAddStudents: () => void
}

export function StudentActionButtons({
  selectedStudentsCount,
  onRemoveStudents,
  onAddStudents,
}: StudentActionButtonsProps) {
  return (
    <div className="mb-6 flex shrink-0 items-start justify-between">
      <div className="flex gap-2">
        {selectedStudentsCount > 0 && (
          <Button variant="destructive" onClick={onRemoveStudents}>
            <Users className="mr-2 h-4 w-4" />
            選択した生徒を削除 ({selectedStudentsCount})
          </Button>
        )}
        <Button onClick={onAddStudents}>
          <Plus className="mr-2 h-4 w-4" />
          生徒を追加
        </Button>
      </div>
    </div>
  )
}
