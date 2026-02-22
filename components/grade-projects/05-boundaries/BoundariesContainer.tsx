"use client"

import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBoundaries } from "@/hooks/grade-projects/useBoundaries"

import { BoundaryEditor } from "./BoundaryEditor"
import { BoundaryPresetSelector } from "./BoundaryPresetSelector"

interface BoundariesContainerProps {
  gradeProjectId: string
}

export function BoundariesContainer({
  gradeProjectId,
}: BoundariesContainerProps) {
  const { project, boundarySets, loading, saveBoundarySet } =
    useBoundaries(gradeProjectId)
  const [activeTab, setActiveTab] = useState("")

  if (loading || !project) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const gradeItems = project.gradeItems
  const effectiveTab = activeTab || gradeItems[0]?.id || ""

  const getExistingBoundaries = (
    targetType: string,
    gradeItemId: string | null
  ) => {
    const set = boundarySets.find(
      (bs) => bs.targetType === targetType && bs.gradeItemId === gradeItemId
    )
    return set?.boundaries ?? []
  }

  const handleSave = async (
    targetType: string,
    gradeItemId: string | null,
    boundaries: { label: string; minPercentage: number; order: number }[]
  ) => {
    await saveBoundarySet({ targetType, gradeItemId, boundaries })
  }

  const handlePreset = (
    targetType: string,
    gradeItemId: string | null,
    boundaries: { label: string; minPercentage: number; order: number }[]
  ) => {
    handleSave(targetType, gradeItemId, boundaries)
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">成績境界設定</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        各パーセンテージ閾値以上でその成績ラベルが付与されます。
      </p>

      <Tabs value={effectiveTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          {gradeItems.map((gi) => (
            <TabsTrigger key={gi.id} value={gi.id}>
              {gi.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {gradeItems.map((gi) => (
          <TabsContent key={gi.id} value={gi.id} className="mt-4">
            <div className="mb-4">
              <BoundaryPresetSelector
                onSelect={(boundaries) =>
                  handlePreset("grade_item", gi.id, boundaries)
                }
              />
            </div>
            <BoundaryEditor
              boundaries={getExistingBoundaries("grade_item", gi.id)}
              onSave={(boundaries) =>
                handleSave("grade_item", gi.id, boundaries)
              }
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link href={`/grade-projects/${gradeProjectId}/06-results`}>
            次へ: 結果
          </Link>
        </Button>
      </div>
    </div>
  )
}
