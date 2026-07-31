"use client"

import type { RosterRow } from "@/components/common/roster-table/types"

interface RosterDragOverlayProps {
  activeRow: RosterRow | null
  selectedIds: Set<string>
}

export function RosterDragOverlay({
  activeRow,
  selectedIds,
}: RosterDragOverlayProps) {
  if (!activeRow) return null

  return (
    <div className="rounded-md border bg-background p-2 shadow-lg">
      <div className="font-medium">
        {activeRow.lastName} {activeRow.firstName}
      </div>
      <div className="text-sm text-muted-foreground">
        {activeRow.classroomInfo.className ?? "-"}
        {selectedIds.size > 1 && ` (+${selectedIds.size - 1}名)`}
      </div>
    </div>
  )
}
