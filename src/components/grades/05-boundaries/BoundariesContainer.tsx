"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useBoundaries } from "@/hooks/grades/useBoundaries"

import { BoundaryEditor } from "./BoundaryEditor"
import { BoundaryPresetSelector } from "./BoundaryPresetSelector"
import { ConstraintRulesEditor } from "./ConstraintRulesEditor"

interface BoundariesContainerProps {
  gradeId: string
}

export function BoundariesContainer({ gradeId }: BoundariesContainerProps) {
  const { exam, boundarySets, loading, saveBoundarySet } =
    useBoundaries(gradeId)

  if (loading || !exam) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const gradeItems = exam.gradeItems

  const getExistingBoundaries = (
    targetType: string,
    gradeItemId: string | null
  ) => {
    const matchedBoundarySet = boundarySets.find(
      (boundarySet) =>
        boundarySet.targetType === targetType &&
        boundarySet.gradeItemId === gradeItemId
    )
    return matchedBoundarySet?.boundaries ?? []
  }

  const handleSave = async (
    targetType: string,
    gradeItemId: string | null,
    boundaries: { label: string; minPercentage: number; order: number }[]
  ) => {
    await saveBoundarySet({ targetType, gradeItemId, boundaries })
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">成績境界設定</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        各パーセンテージ閾値以上でその成績ラベルが付与されます。
      </p>

      <div className="space-y-4">
        {gradeItems.map((gradeItem) => (
          <Card key={gradeItem.id} className="space-y-3 p-4">
            <h3 className="text-base font-semibold">{gradeItem.name}</h3>
            <BoundaryPresetSelector
              onSelect={(boundaries) =>
                handleSave("grade_item", gradeItem.id, boundaries)
              }
            />
            <BoundaryEditor
              boundaries={getExistingBoundaries("grade_item", gradeItem.id)}
              onSave={(boundaries) =>
                handleSave("grade_item", gradeItem.id, boundaries)
              }
            />
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      <ConstraintRulesEditor
        gradeId={gradeId}
        gradeItems={gradeItems}
        boundarySets={boundarySets}
      />

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link href={`/grades/${gradeId}/06-results`}>次へ: 結果</Link>
        </Button>
      </div>
    </div>
  )
}
