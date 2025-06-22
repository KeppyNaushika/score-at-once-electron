"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Users } from "lucide-react"
import SpreadsheetEditor from "@/components/common/SpreadsheetEditor"
import ValidationResults from "@/components/common/ValidationResults"

interface StudentImportRow {
  studentId?: string
  lastName?: string
  firstName?: string
  lastNameKana?: string
  firstNameKana?: string
  enrollmentYear?: number
}

interface ValidationResult {
  valid: number
  errors: string[]
  warnings: string[]
}

interface StudentSpreadsheetPanelProps {
  studentData: StudentImportRow[]
  studentValidation: ValidationResult
  onDataChange: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export default function StudentSpreadsheetPanel({
  studentData,
  studentValidation,
  onDataChange,
  containerRef
}: StudentSpreadsheetPanelProps) {
  const columns = [
    { title: '学籍番号', width: 100 },
    { title: '姓', width: 100 },
    { title: '名', width: 100 },
    { title: '姓カナ', width: 120 },
    { title: '名カナ', width: 120 },
    { title: '入学年度', width: 80 },
  ]
  
  const initialData = [
    ['001', '田中', '太郎', 'タナカ', 'タロウ', '2024'],
    ['002', '山田', '花子', 'ヤマダ', 'ハナコ', '2024'],
  ]

  return (
    <div className="space-y-6">
      {/* 生徒データ入力 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">生徒情報の入力</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Copy className="h-4 w-4" />
              6列: 学籍番号, 姓, 名, 姓カナ, 名カナ, 入学年度
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

      {/* 生徒バリデーション結果 */}
      {studentData.length > 0 && (
        <ValidationResults
          title="生徒データ検証結果"
          icon={<Users className="h-4 w-4" />}
          validation={studentValidation}
          validUnit="名"
        />
      )}
    </div>
  )
}