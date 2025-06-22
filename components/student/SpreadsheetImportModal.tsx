"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, UserPlus, Settings } from "lucide-react"
import { useSpreadsheetImport } from "@/hooks/useSpreadsheetImport"
import StudentSpreadsheetPanel from "./StudentSpreadsheetPanel"
import ClassAssignmentPanel from "./ClassAssignmentPanel"

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

interface SpreadsheetImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (importedStudents: StudentWithMemberships[]) => void
  existingClasses: ClassWithMemberships[]
}

export default function SpreadsheetImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  existingClasses,
}: SpreadsheetImportModalProps) {
  const [activeTab, setActiveTab] = useState<"students" | "classes">("students")
  
  const {
    studentSpreadsheetRef,
    classSpreadsheetRef,
    studentData,
    classAssignmentData,
    studentValidation,
    classValidation,
    isProcessing,
    importedStudents,
    initializeJSuites,
    extractStudentData,
    extractClassAssignmentData,
    handleImportStudents,
    handleImportClassAssignments,
    setSpreadsheetInitialized,
  } = useSpreadsheetImport(existingClasses)

  useEffect(() => {
    if (isOpen) {
      initializeJSuites().then(() => {
        initializeStudentSpreadsheet().then(() => {
          setTimeout(() => {
            initializeClassSpreadsheet()
          }, 200)
        })
      })
    }
  }, [isOpen])

  const initializeStudentSpreadsheet = async () => {
    try {
      const jspreadsheet = await import('jspreadsheet-ce')

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

        const instance = (jspreadsheet.default || jspreadsheet)(studentSpreadsheetRef.current, {
          data,
          columns,
          onchange: extractStudentData,
          allowInsertRow: true,
          allowDeleteRow: true,
          allowRenameColumn: false,
          columnSorting: false,
          csvHeaders: true,
          parseFormulas: false,
          minDimensions: [6, 10],
        } as any)
        
        setSpreadsheetInitialized(true)
      }
    } catch (error) {
      console.error('Failed to initialize student spreadsheet:', error)
    }
  }

  const initializeClassSpreadsheet = async () => {
    try {
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

        const instance = (jspreadsheet.default || jspreadsheet)(classSpreadsheetRef.current, {
          data,
          columns,
          onchange: extractClassAssignmentData,
          allowInsertRow: true,
          allowDeleteRow: true,
          allowRenameColumn: false,
          columnSorting: false,
          csvHeaders: true,
          parseFormulas: false,
          minDimensions: [2, 10],
        } as any)
      }
    } catch (error) {
      console.error('Failed to initialize class spreadsheet:', error)
    }
  }

  const handleStudentImport = async () => {
    try {
      const imported = await handleImportStudents()
      if (imported) {
        setActiveTab("classes")
      }
    } catch (error) {
      alert('生徒のインポートに失敗しました。')
    }
  }

  const handleClassImport = async () => {
    try {
      const finalStudents = await handleImportClassAssignments()
      if (finalStudents) {
        onImportSuccess(finalStudents)
        onClose()
      }
    } catch (error) {
      alert('学級配置に失敗しました。')
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

          <TabsContent value="students">
            <StudentSpreadsheetPanel
              studentData={studentData}
              studentValidation={studentValidation}
              onDataChange={extractStudentData}
              containerRef={studentSpreadsheetRef}
            />
          </TabsContent>

          <TabsContent value="classes">
            <ClassAssignmentPanel
              classAssignmentData={classAssignmentData}
              classValidation={classValidation}
              existingClasses={existingClasses}
              onDataChange={extractClassAssignmentData}
              containerRef={classSpreadsheetRef}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          {activeTab === "students" ? (
            <Button 
              onClick={handleStudentImport}
              disabled={studentValidation.errors.length > 0 || studentData.length === 0 || isProcessing}
            >
              {isProcessing ? "登録中..." : `${studentValidation.valid}名を登録してステップ2へ`}
            </Button>
          ) : (
            <Button 
              onClick={handleClassImport}
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