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
import { Label } from "@/components/ui/label"
import { 
  Upload, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Info,
  Users,
  BookOpen,
  UserPlus,
  Settings
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
  isVisible?: boolean
}

interface StudentWithMemberships {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
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
    }
  }>
}

interface SpreadsheetImportModalV2Props {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (importedStudents: StudentWithMemberships[]) => void
  existingClasses: ClassWithMemberships[]
}

interface StudentImportRow {
  studentId?: string
  lastName?: string
  firstName?: string
  lastNameKana?: string
  firstNameKana?: string
  enrollmentYear?: number
}

interface ClassAssignmentRow {
  studentId?: string
  classCode?: string
}

export default function SpreadsheetImportModalV2({
  isOpen,
  onClose,
  onImportSuccess,
  existingClasses,
}: SpreadsheetImportModalV2Props) {
  const studentSpreadsheetRef = useRef<HTMLDivElement>(null)
  const classSpreadsheetRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<"students" | "classes">("students")
  const [studentData, setStudentData] = useState<StudentImportRow[]>([])
  const [classAssignmentData, setClassAssignmentData] = useState<ClassAssignmentRow[]>([])
  const [studentValidation, setStudentValidation] = useState<{
    valid: number
    errors: string[]
    warnings: string[]
  }>({ valid: 0, errors: [], warnings: [] })
  const [classValidation, setClassValidation] = useState<{
    valid: number
    errors: string[]
    warnings: string[]
  }>({ valid: 0, errors: [], warnings: [] })
  const [isProcessing, setIsProcessing] = useState(false)
  const [importedStudents, setImportedStudents] = useState<StudentWithMemberships[]>([])

  // 学級コードと名前のマッピングを作成
  const classMap = new Map<string, ClassWithMemberships>()
  existingClasses.filter(cls => cls.isVisible !== false).forEach(cls => {
    classMap.set(cls.name, cls)
    if (cls.classCode) {
      classMap.set(cls.classCode, cls)
    }
  })

  useEffect(() => {
    if (isOpen) {
      initializeStudentSpreadsheet()
      initializeClassSpreadsheet()
    }
  }, [isOpen])

  const initializeStudentSpreadsheet = async () => {
    const jspreadsheet = await import('jspreadsheet-ce')
    
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

    if (studentSpreadsheetRef.current) {
      studentSpreadsheetRef.current.innerHTML = ''

      const columns = [
        { title: '学籍番号', width: 100 },
        { title: '姓', width: 100 },
        { title: '名', width: 100 },
        { title: '姓カナ', width: 120 },
        { title: '名カナ', width: 120 },
        { title: '入学年度', width: 80 },
      ]
      
      const data = [
        ['001', '田中', '太郎', 'タナカ', 'タロウ', '2024'],
        ['002', '山田', '花子', 'ヤマダ', 'ハナコ', '2024'],
      ]

      jspreadsheet.default(studentSpreadsheetRef.current, {
        data,
        columns,
        onchange: () => {
          extractStudentData()
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

  const initializeClassSpreadsheet = async () => {
    const jspreadsheet = await import('jspreadsheet-ce')

    if (classSpreadsheetRef.current) {
      classSpreadsheetRef.current.innerHTML = ''

      const columns = [
        { title: '学籍番号', width: 100 },
        { title: 'クラスコード', width: 120 },
      ]
      
      const data = [
        ['001', '1A'],
        ['001', 'E1'],
        ['001', 'M2'],
        ['002', '1A'],
        ['002', 'E2'],
        ['002', 'M1'],
      ]

      jspreadsheet.default(classSpreadsheetRef.current, {
        data,
        columns,
        onchange: () => {
          extractClassAssignmentData()
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

  const extractStudentData = () => {
    if (!studentSpreadsheetRef.current) return

    try {
      const spreadsheet = (studentSpreadsheetRef.current as any).jspreadsheet
      if (!spreadsheet) return

      const data = spreadsheet.getData()
      const rows: StudentImportRow[] = []

      data.forEach((row: any[]) => {
        if (!row[0] || !row[1] || !row[2]) return // 学籍番号、姓、名が必須

        rows.push({
          studentId: row[0]?.toString().trim(),
          lastName: row[1]?.toString().trim(),
          firstName: row[2]?.toString().trim(),
          lastNameKana: row[3]?.toString().trim() || '',
          firstNameKana: row[4]?.toString().trim() || '',
          enrollmentYear: row[5] ? parseInt(row[5].toString()) : undefined,
        })
      })

      setStudentData(rows)
      validateStudentData(rows)
    } catch (error) {
      console.error('Error extracting student data:', error)
    }
  }

  const extractClassAssignmentData = () => {
    if (!classSpreadsheetRef.current) return

    try {
      const spreadsheet = (classSpreadsheetRef.current as any).jspreadsheet
      if (!spreadsheet) return

      const data = spreadsheet.getData()
      const rows: ClassAssignmentRow[] = []

      data.forEach((row: any[]) => {
        if (!row[0] || !row[1]) return // 学籍番号、クラスコードが必須

        rows.push({
          studentId: row[0]?.toString().trim(),
          classCode: row[1]?.toString().trim(),
        })
      })

      setClassAssignmentData(rows)
      validateClassAssignmentData(rows)
    } catch (error) {
      console.error('Error extracting class assignment data:', error)
    }
  }

  const validateStudentData = (data: StudentImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    const seenStudentIds = new Set<string>()
    let validCount = 0

    data.forEach((row, index) => {
      const rowNum = index + 1

      if (!row.studentId) {
        errors.push(`行${rowNum}: 学籍番号が入力されていません`)
        return
      }
      if (!row.lastName) {
        errors.push(`行${rowNum}: 姓が入力されていません`)
        return
      }
      if (!row.firstName) {
        errors.push(`行${rowNum}: 名が入力されていません`)
        return
      }

      // 重複チェック
      if (seenStudentIds.has(row.studentId)) {
        errors.push(`行${rowNum}: 学籍番号「${row.studentId}」が重複しています`)
        return
      }
      seenStudentIds.add(row.studentId)

      // カナの警告
      if (!row.lastNameKana) {
        warnings.push(`行${rowNum}: 姓カナが入力されていません`)
      }
      if (!row.firstNameKana) {
        warnings.push(`行${rowNum}: 名カナが入力されていません`)
      }

      validCount++
    })

    setStudentValidation({ valid: validCount, errors, warnings })
  }

  const validateClassAssignmentData = (data: ClassAssignmentRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    let validCount = 0

    // 生徒データの学籍番号セット
    const availableStudentIds = new Set(studentData.map(s => s.studentId))

    data.forEach((row, index) => {
      const rowNum = index + 1

      if (!row.studentId) {
        errors.push(`行${rowNum}: 学籍番号が入力されていません`)
        return
      }
      if (!row.classCode) {
        errors.push(`行${rowNum}: クラスコードが入力されていません`)
        return
      }

      // 生徒の存在チェック
      if (!availableStudentIds.has(row.studentId)) {
        warnings.push(`行${rowNum}: 学籍番号「${row.studentId}」の生徒が見つかりません`)
      }

      // 学級の存在チェック
      if (!classMap.has(row.classCode)) {
        warnings.push(`行${rowNum}: クラスコード「${row.classCode}」が見つかりません`)
      }

      validCount++
    })

    setClassValidation({ valid: validCount, errors, warnings })
  }

  const handleImportStudents = async () => {
    if (studentValidation.errors.length > 0) return

    setIsProcessing(true)

    try {
      const imported: StudentWithMemberships[] = []

      for (const row of studentData) {
        const studentData = {
          studentId: row.studentId!,
          lastName: row.lastName!,
          firstName: row.firstName!,
          lastNameKana: row.lastNameKana || '',
          firstNameKana: row.firstNameKana || '',
          enrollmentYear: row.enrollmentYear,
        }

        const newStudent = await window.electronAPI.createStudent(studentData)
        imported.push(newStudent)
      }

      setImportedStudents(imported)
      setActiveTab("classes")
    } catch (error) {
      console.error('Student import failed:', error)
      alert('生徒のインポートに失敗しました。')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImportClassAssignments = async () => {
    if (classValidation.errors.length > 0) return

    setIsProcessing(true)

    try {
      const studentMap = new Map(importedStudents.map(s => [s.studentId, s]))

      for (const row of classAssignmentData) {
        const student = studentMap.get(row.studentId!)
        const classRecord = classMap.get(row.classCode!)
        
        if (student && classRecord) {
          await window.electronAPI.addStudentToClass(
            student.id,
            classRecord.id,
            new Date(),
            "REGULAR",
            classRecord.subject,
            undefined
          )
        }
      }

      // 最新の学生データを取得
      const updatedStudents = await window.electronAPI.fetchStudents()
      const finalImportedStudents = updatedStudents.filter((s: any) =>
        importedStudents.some(imported => imported.id === s.id)
      )

      onImportSuccess(finalImportedStudents)
      onClose()
    } catch (error) {
      console.error('Class assignment failed:', error)
      alert('学級配置に失敗しました。')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            生徒データのインポート（2段階プロセス）
          </DialogTitle>
          <DialogDescription>
            ステップ1で生徒を登録し、ステップ2で学級に配置します。
            各ステップでExcelやスプレッドシートからコピー&ペーストが可能です。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="students" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              ステップ1: 生徒登録
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex items-center gap-2" disabled={importedStudents.length === 0}>
              <Settings className="h-4 w-4" />
              ステップ2: 学級配置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            {/* 生徒データ入力 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">生徒情報の入力</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Copy className="h-4 w-4" />
                    5列: 学籍番号, 姓, 名, 姓カナ, 名カナ, 入学年度
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  ref={studentSpreadsheetRef} 
                  className="border rounded-md min-h-[300px] overflow-auto"
                  style={{ fontSize: '13px' }}
                />
              </CardContent>
            </Card>

            {/* 生徒バリデーション結果 */}
            {studentData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    生徒データ検証結果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Badge variant="default" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        有効な生徒: {studentValidation.valid}名
                      </Badge>
                      {studentValidation.errors.length > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          エラー: {studentValidation.errors.length}件
                        </Badge>
                      )}
                      {studentValidation.warnings.length > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          警告: {studentValidation.warnings.length}件
                        </Badge>
                      )}
                    </div>

                    {studentValidation.errors.length > 0 && (
                      <div>
                        <Label className="text-destructive font-medium">エラー</Label>
                        <ul className="text-sm text-destructive mt-1 space-y-1">
                          {studentValidation.errors.slice(0, 5).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                          {studentValidation.errors.length > 5 && (
                            <li className="text-muted-foreground">
                              ... 他{studentValidation.errors.length - 5}件
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {studentValidation.warnings.length > 0 && (
                      <div>
                        <Label className="text-amber-600 font-medium">警告</Label>
                        <ul className="text-sm text-amber-600 mt-1 space-y-1">
                          {studentValidation.warnings.slice(0, 3).map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                          {studentValidation.warnings.length > 3 && (
                            <li className="text-muted-foreground">
                              ... 他{studentValidation.warnings.length - 3}件
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="classes" className="space-y-6">
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
                  ref={classSpreadsheetRef} 
                  className="border rounded-md min-h-[300px] overflow-auto"
                  style={{ fontSize: '13px' }}
                />
              </CardContent>
            </Card>

            {/* 学級配置バリデーション結果 */}
            {classAssignmentData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    学級配置検証結果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Badge variant="default" className="flex items-center gap-1">
                        <Settings className="h-3 w-3" />
                        有効な配置: {classValidation.valid}件
                      </Badge>
                      {classValidation.errors.length > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          エラー: {classValidation.errors.length}件
                        </Badge>
                      )}
                      {classValidation.warnings.length > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          警告: {classValidation.warnings.length}件
                        </Badge>
                      )}
                    </div>

                    {classValidation.errors.length > 0 && (
                      <div>
                        <Label className="text-destructive font-medium">エラー</Label>
                        <ul className="text-sm text-destructive mt-1 space-y-1">
                          {classValidation.errors.slice(0, 5).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {classValidation.warnings.length > 0 && (
                      <div>
                        <Label className="text-amber-600 font-medium">警告</Label>
                        <ul className="text-sm text-amber-600 mt-1 space-y-1">
                          {classValidation.warnings.slice(0, 3).map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 利用可能な学級一覧 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  利用可能な学級（{existingClasses.filter(c => c.isVisible !== false).length}学級）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {existingClasses.filter(cls => cls.isVisible !== false).map(cls => (
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
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          {activeTab === "students" ? (
            <Button 
              onClick={handleImportStudents}
              disabled={studentValidation.errors.length > 0 || studentData.length === 0 || isProcessing}
            >
              {isProcessing ? "登録中..." : `${studentValidation.valid}名を登録してステップ2へ`}
            </Button>
          ) : (
            <Button 
              onClick={handleImportClassAssignments}
              disabled={classValidation.errors.length > 0 || classAssignmentData.length === 0 || isProcessing}
            >
              {isProcessing ? "配置中..." : `${classValidation.valid}件の配置を完了`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}