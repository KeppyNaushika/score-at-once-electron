"use client"

import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useBoundaries } from "@/hooks/grades/useBoundaries"
import type { GradeItemWithDataSources } from "@/types/grade.types"

import { BoundaryEditor } from "./BoundaryEditor"
import { BoundaryPresetSelector } from "./BoundaryPresetSelector"
import { ConstraintRulesEditor } from "./ConstraintRulesEditor"

interface BoundariesContainerProps {
  gradeId: string
}

export function BoundariesContainer({ gradeId }: BoundariesContainerProps) {
  const { grade, loading, saveBoundaries, deleteBoundaries } =
    useBoundaries(gradeId)

  const [deletionTargetGradeItem, setDeletionTargetGradeItem] =
    useState<GradeItemWithDataSources | null>(null)

  if (loading || !grade) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const gradeItems = grade.gradeItems

  const handleSave = async (
    gradeItemId: string,
    boundaries: { label: string; minPercentage: number; order: number }[]
  ) => {
    await saveBoundaries({ gradeItemId, boundaries })
  }

  const handleDelete = async (targetGradeItem: GradeItemWithDataSources) => {
    const result = await deleteBoundaries(targetGradeItem.id)
    if (!result.success) {
      toast.error("成績境界を削除できませんでした", {
        description: result.error,
      })
    }
    setDeletionTargetGradeItem(null)
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">成績境界設定</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        各パーセンテージ閾値以上でその成績ラベルが付与されます。
      </p>

      <div className="space-y-4">
        {gradeItems.map((gradeItem) => (
          <Card key={gradeItem.id} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{gradeItem.name}</h3>
              {gradeItem.boundaries.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setDeletionTargetGradeItem(gradeItem)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  境界設定を削除
                </Button>
              )}
            </div>
            <BoundaryPresetSelector
              onSelect={(boundaries) => handleSave(gradeItem.id, boundaries)}
            />
            <BoundaryEditor
              gradeItem={gradeItem}
              onSave={(boundaries) => handleSave(gradeItem.id, boundaries)}
            />
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      <ConstraintRulesEditor gradeId={gradeId} gradeItems={gradeItems} />

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link href={`/grades/${gradeId}/06-results`}>次へ: 結果</Link>
        </Button>
      </div>

      <AlertDialog
        open={deletionTargetGradeItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeletionTargetGradeItem(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              「{deletionTargetGradeItem?.name}
              」の成績境界を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              この評価項目には成績ラベルが付かなくなり、結果画面と出力のラベル欄が空になります。確定済みの成績値に記録されたラベルはそのまま残ります。制約ルールが選べるラベルからもこの評価項目のラベルが外れるため、そのラベルを使っているルールは設定し直してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletionTargetGradeItem) {
                  void handleDelete(deletionTargetGradeItem)
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
