"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { 
  Upload, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Info,
  Users,
  BookOpen
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  subject?: string | null
  classType: string
}

interface StudentWithMemberships {
  id: string
  studentId: string
  name: string
  enrollmentYear?: number | null
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    membershipType: string
    subject?: string | null
    notes?: string | null
    class: {
      id: string
      name: string
      classCode?: string | null
      subject?: string | null
      classType: string
    }
  }>
}

interface SpreadsheetImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (importedStudents: StudentWithMemberships[]) => void
  existingClasses: ClassWithMemberships[]
}

interface ImportRow {
  name?: string
  studentId?: string
  enrollmentYear?: number
  homeroomClass?: string
  additionalClasses?: string[]
  [key: string]: any
}

export default function SpreadsheetImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  existingClasses,
}: SpreadsheetImportModalProps) {
  const spreadsheetRef = useRef<HTMLDivElement>(null)
  const [importData, setImportData] = useState<ImportRow[]>([])
  const [importStrategy, setImportStrategy] = useState<"multi-column" | "comma-separated" | "main-additional">("multi-column")
  const [validationResults, setValidationResults] = useState<{
    valid: number
    errors: string[]
    warnings: string[]
  }>({ valid: 0, errors: [], warnings: [] })
  const [isProcessing, setIsProcessing] = useState(false)

  // 学級コードと名前のマッピングを作成
  const classMap = new Map<string, ClassWithMemberships>()
  existingClasses.forEach(cls => {
    classMap.set(cls.name, cls)
    if (cls.classCode) {
      classMap.set(cls.classCode, cls)
    }
  })

  useEffect(() => {
    if (isOpen && spreadsheetRef.current) {
      initializeSpreadsheet()
    }
  }, [isOpen, importStrategy])

  const initializeSpreadsheet = async () => {
    // 動的インポートでjspreadsheetを読み込み
    const jspreadsheet = await import('jspreadsheet-ce')
    const jSuites = await import('jsuites')
    
    // スタイルシートをロード
    if (!document.querySelector('link[href*="jspreadsheet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce@4/dist/jspreadsheet.css'
      document.head.appendChild(link)
    }
    
    if (!document.querySelector('link[href*="jsuites"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet' 
      link.href = 'https://cdn.jsdelivr.net/npm/jsuites@4/dist/jsuites.css'
      document.head.appendChild(link)
    }

    if (spreadsheetRef.current) {
      // 既存のスプレッドシートをクリア
      spreadsheetRef.current.innerHTML = ''

      let columns: any[] = []
      let data: any[][] = []

      if (importStrategy === "multi-column") {
        columns = [
          { title: '氏名', width: 120 },
          { title: '学籍番号', width: 100 },
          { title: '入学年度', width: 80 },
          { title: 'ホームルーム', width: 100 },
          { title: '国語クラス', width: 100 },
          { title: '数学クラス', width: 100 },
          { title: '英語クラス', width: 100 },
          { title: '理科クラス', width: 100 },
          { title: '社会クラス', width: 100 },
        ]
        data = [
          ['田中太郎', '001', '2024', '1A', '', 'M1', 'E2', '', ''],
          ['山田花子', '002', '2024', '1A', '', 'M2', 'E1', '', ''],
        ]
      } else if (importStrategy === "comma-separated") {
        columns = [
          { title: '氏名', width: 120 },
          { title: '学籍番号', width: 100 },
          { title: '入学年度', width: 80 },
          { title: '所属クラス（カンマ区切り）', width: 200 },
        ]
        data = [
          ['田中太郎', '001', '2024', '1A,M1,E2'],
          ['山田花子', '002', '2024', '1A,M2,E1'],
        ]
      } else { // main-additional
        columns = [
          { title: '氏名', width: 120 },
          { title: '学籍番号', width: 100 },
          { title: '入学年度', width: 80 },
          { title: 'メインクラス', width: 100 },
          { title: '追加クラス（カンマ区切り）', width: 150 },
        ]
        data = [
          ['田中太郎', '001', '2024', '1A', 'M1,E2'],
          ['山田花子', '002', '2024', '1A', 'M2,E1'],
        ]
      }

      // スプレッドシートを初期化
      jspreadsheet.default(spreadsheetRef.current, {
        data,
        columns,
        onchange: () => {
          extractDataFromSpreadsheet()
        },
        contextMenu: true,
        allowInsertRow: true,
        allowDeleteRow: true,
        allowRenameColumn: false,
        columnSorting: false,
        csvHeaders: true,
        parseFormulas: false,
      })
    }
  }

  const extractDataFromSpreadsheet = () => {
    if (!spreadsheetRef.current) return

    try {
      // スプレッドシートからデータを取得
      const spreadsheet = (spreadsheetRef.current as any).jspreadsheet
      if (!spreadsheet) return

      const data = spreadsheet.getData()
      const rows: ImportRow[] = []

      data.forEach((row: any[], index: number) => {
        if (!row[0] || !row[1]) return // 氏名と学籍番号が必須

        const importRow: ImportRow = {
          name: row[0]?.toString().trim(),
          studentId: row[1]?.toString().trim(),
          enrollmentYear: row[2] ? parseInt(row[2].toString()) : undefined,
        }

        if (importStrategy === "multi-column") {
          importRow.homeroomClass = row[3]?.toString().trim() || undefined
          importRow.additionalClasses = [
            row[4]?.toString().trim(), // 国語
            row[5]?.toString().trim(), // 数学
            row[6]?.toString().trim(), // 英語
            row[7]?.toString().trim(), // 理科
            row[8]?.toString().trim(), // 社会
          ].filter(Boolean)
        } else if (importStrategy === "comma-separated") {
          const classes = row[3]?.toString().split(',').map((c: string) => c.trim()).filter(Boolean) || []
          importRow.additionalClasses = classes
        } else { // main-additional
          importRow.homeroomClass = row[3]?.toString().trim() || undefined
          const additionalClasses = row[4]?.toString().split(',').map((c: string) => c.trim()).filter(Boolean) || []
          importRow.additionalClasses = additionalClasses
        }

        rows.push(importRow)
      })

      setImportData(rows)
      validateImportData(rows)
    } catch (error) {
      console.error('Error extracting spreadsheet data:', error)
    }
  }

  const validateImportData = (data: ImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    let validCount = 0

    data.forEach((row, index) => {
      const rowNum = index + 1

      // 必須フィールドチェック
      if (!row.name) {
        errors.push(`行${rowNum}: 氏名が入力されていません`)
        return
      }
      if (!row.studentId) {
        errors.push(`行${rowNum}: 学籍番号が入力されていません`)
        return
      }

      // 学級の存在チェック
      const allClasses = [
        row.homeroomClass,
        ...(row.additionalClasses || [])
      ].filter(Boolean)

      allClasses.forEach(className => {
        if (!classMap.has(className!)) {
          warnings.push(`行${rowNum}: 学級「${className}」が見つかりません`)
        }
      })

      if (allClasses.length === 0) {
        warnings.push(`行${rowNum}: 所属学級が指定されていません`)
      }

      validCount++
    })

    setValidationResults({ valid: validCount, errors, warnings })
  }

  const handleImport = async () => {
    if (validationResults.errors.length > 0) {
      return
    }

    setIsProcessing(true)

    try {
      const importedStudents: StudentWithMemberships[] = []

      for (const row of importData) {
        // 生徒を作成
        const studentData = {
          studentId: row.studentId!,
          name: row.name!,
          enrollmentYear: row.enrollmentYear,
        }

        const newStudent = await window.electronAPI.createStudent(studentData)

        // 学級への所属を作成
        const allClasses = [
          row.homeroomClass,
          ...(row.additionalClasses || [])
        ].filter(Boolean)

        for (const className of allClasses) {
          const classRecord = classMap.get(className!)
          if (classRecord) {
            await window.electronAPI.addStudentToClass(
              newStudent.id,
              classRecord.id,
              new Date(),
              "REGULAR",
              classRecord.subject,
              undefined
            )
          }
        }

        // 最新の学生データを取得（所属関係含む）
        const updatedStudents = await window.electronAPI.fetchStudents()
        const importedStudent = updatedStudents.find((s: any) => s.id === newStudent.id)
        if (importedStudent) {
          importedStudents.push(importedStudent)
        }
      }

      onImportSuccess(importedStudents)
      onClose()
    } catch (error) {
      console.error('Import failed:', error)
      alert('インポートに失敗しました。')
    } finally {
      setIsProcessing(false)
    }
  }

  const strategyDescriptions = {
    "multi-column": "各教科やクラス種別ごとに列を分けて入力する方式",
    "comma-separated": "すべての所属クラスを一つの列にカンマ区切りで入力する方式",
    "main-additional": "メインクラス（ホームルーム）と追加クラスを分けて入力する方式"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            生徒データのインポート（表形式）
          </DialogTitle>
          <DialogDescription>
            表計算ソフトのようなインターフェースで生徒データを入力・編集できます。
            Excelやスプレッドシートからコピー&ペーストも可能です。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* インポート方式選択 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">インポート方式</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select value={importStrategy} onValueChange={(value: any) => setImportStrategy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multi-column">
                      <div>
                        <div className="font-medium">複数列方式</div>
                        <div className="text-xs text-muted-foreground">教科別に列を分ける</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="comma-separated">
                      <div>
                        <div className="font-medium">カンマ区切り方式</div>
                        <div className="text-xs text-muted-foreground">所属クラスを一つの列に</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="main-additional">
                      <div>
                        <div className="font-medium">メイン＋追加方式</div>
                        <div className="text-xs text-muted-foreground">ホームルームと追加クラスを分離</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {strategyDescriptions[importStrategy]}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* スプレッドシート */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">データ入力</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Copy className="h-4 w-4" />
                  Ctrl+V でペースト可能
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={spreadsheetRef} 
                className="border rounded-md min-h-[300px] overflow-auto"
                style={{ fontSize: '13px' }}
              />
            </CardContent>
          </Card>

          {/* バリデーション結果 */}
          {importData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  バリデーション結果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Badge variant="default" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      有効な生徒: {validationResults.valid}名
                    </Badge>
                    {validationResults.errors.length > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        エラー: {validationResults.errors.length}件
                      </Badge>
                    )}
                    {validationResults.warnings.length > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        警告: {validationResults.warnings.length}件
                      </Badge>
                    )}
                  </div>

                  {validationResults.errors.length > 0 && (
                    <div>
                      <Label className="text-destructive font-medium">エラー</Label>
                      <ul className="text-sm text-destructive mt-1 space-y-1">
                        {validationResults.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResults.warnings.length > 0 && (
                    <div>
                      <Label className="text-amber-600 font-medium">警告</Label>
                      <ul className="text-sm text-amber-600 mt-1 space-y-1">
                        {validationResults.warnings.slice(0, 5).map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                        {validationResults.warnings.length > 5 && (
                          <li className="text-muted-foreground">
                            ... 他{validationResults.warnings.length - 5}件
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 既存学級一覧 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                利用可能な学級（{existingClasses.length}学級）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {existingClasses.map(cls => (
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
                        <div>種別: {
                          cls.classType === "HOMEROOM" ? "ホームルーム" :
                          cls.classType === "SUBJECT" ? "教科別" :
                          cls.classType === "ABILITY_GROUPED" ? "習熟度別" : "特別"
                        }</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button 
            onClick={handleImport}
            disabled={validationResults.errors.length > 0 || importData.length === 0 || isProcessing}
          >
            {isProcessing ? "インポート中..." : `${validationResults.valid}名をインポート`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}