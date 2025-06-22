"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Settings, BookOpen } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import ValidationResults from "@/components/common/ValidationResults"

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  subject?: string | null
  isVisible?: boolean
}

interface ClassAssignmentRow {
  studentId?: string
  classCode?: string
}

interface ValidationResult {
  valid: number
  errors: string[]
  warnings: string[]
}

interface ClassAssignmentPanelProps {
  classAssignmentData: ClassAssignmentRow[]
  classValidation: ValidationResult
  existingClasses: ClassWithMemberships[]
  onDataChange: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export default function ClassAssignmentPanel({
  classAssignmentData,
  classValidation,
  existingClasses,
  onDataChange,
  containerRef
}: ClassAssignmentPanelProps) {
  const visibleClasses = existingClasses.filter(cls => cls.isVisible !== false)

  return (
    <div className="space-y-6">
      {/* 学級配置データ入力 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">学級配置の入力</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Copy className="h-4 w-4" />
              2列: 学籍番号, クラスコード（複数行で複数クラス所属）
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            ref={containerRef} 
            className="border rounded-md min-h-[300px] overflow-auto"
            style={{ fontSize: '13px' }}
          />
        </CardContent>
      </Card>

      {/* 学級配置バリデーション結果 */}
      {classAssignmentData.length > 0 && (
        <ValidationResults
          title="学級配置検証結果"
          icon={<Settings className="h-4 w-4" />}
          validation={classValidation}
          validUnit="件"
        />
      )}

      {/* 利用可能な学級一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            利用可能な学級（{visibleClasses.length}学級）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {visibleClasses.map(cls => (
              <Tooltip key={cls.id}>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs">
                    {cls.classCode || cls.name}
                    {cls.subject && ` (${cls.subject})`}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div>
                    <div className="font-medium">{cls.name}</div>
                    {cls.classCode && <div>コード: {cls.classCode}</div>}
                    {cls.subject && <div>教科: {cls.subject}</div>}
                    {cls.grade && <div>学年: {cls.grade}年</div>}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}