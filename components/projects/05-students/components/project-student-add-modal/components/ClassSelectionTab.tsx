"use client"

import SortableClassList from "@/components/projects/05-students/components/SortableClassList"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { TabsContent } from "@/components/ui/tabs"
import type { AvailableClass } from "@/components/projects/05-students/components/project-student-add-modal/types/project-student-add-types"

interface ClassSelectionTabProps {
  availableClasses: AvailableClass[]
  loading: boolean
  onClassSelection: (classId: string, isSelected: boolean) => void
  onClassReorder: (reorderedClasses: AvailableClass[]) => void
}

export function ClassSelectionTab({
  availableClasses,
  loading,
  onClassSelection,
  onClassReorder,
}: ClassSelectionTabProps) {
  return (
    <TabsContent
      value="classes"
      className="mt-4 h-full space-y-4 overflow-auto"
    >
      <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 利用可能な学級一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">利用可能な学級</CardTitle>
            <CardDescription>
              追加したい学級を選択してください
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 space-y-3 overflow-auto">
            {loading ? (
              <div className="py-4 text-center">読み込み中...</div>
            ) : availableClasses.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center">
                追加可能な学級がありません
              </div>
            ) : (
              availableClasses.map((classItem) => (
                <Card key={classItem.id} className="p-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`class-${classItem.id}`}
                      checked={classItem.isSelected}
                      onCheckedChange={(checked) =>
                        onClassSelection(classItem.id, checked as boolean)
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`class-${classItem.id}`}
                          className="cursor-pointer font-medium"
                        >
                          {classItem.name}
                        </label>
                        <Badge variant="outline">
                          {classItem.studentCount}名
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* 追加順序設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">追加順序</CardTitle>
            <CardDescription>
              選択した学級の追加順序を設定できます
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 overflow-auto">
            <SortableClassList
              selectedClasses={availableClasses.filter((cls) => cls.isSelected)}
              onReorder={onClassReorder}
            />
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  )
}
