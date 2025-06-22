import { useState, useRef } from "react"

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

interface ValidationResult {
  valid: number
  errors: string[]
  warnings: string[]
}

export function useSpreadsheetImport(existingClasses: ClassWithMemberships[]) {
  const studentSpreadsheetRef = useRef<HTMLDivElement>(null)
  const classSpreadsheetRef = useRef<HTMLDivElement>(null)
  
  const [studentData, setStudentData] = useState<StudentImportRow[]>([])
  const [classAssignmentData, setClassAssignmentData] = useState<ClassAssignmentRow[]>([])
  const [studentValidation, setStudentValidation] = useState<ValidationResult>({ 
    valid: 0, errors: [], warnings: [] 
  })
  const [classValidation, setClassValidation] = useState<ValidationResult>({ 
    valid: 0, errors: [], warnings: [] 
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [importedStudents, setImportedStudents] = useState<StudentWithMemberships[]>([])
  const [spreadsheetInitialized, setSpreadsheetInitialized] = useState(false)

  // 学級コードと名前のマッピングを作成
  const classMap = new Map<string, ClassWithMemberships>()
  existingClasses.filter(cls => cls.isVisible !== false).forEach(cls => {
    classMap.set(cls.name, cls)
    if (cls.classCode) {
      classMap.set(cls.classCode, cls)
    }
  })

  const initializeJSuites = async () => {
    const jsuites = await import('jsuites')
    
    if (typeof window !== 'undefined') {
      (window as any).jSuites = jsuites.default || jsuites;
      (window as any).jsuites = jsuites.default || jsuites;
    }
    
    // Load stylesheets
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

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const extractStudentData = () => {
    if (!studentSpreadsheetRef.current) return

    try {
      const spreadsheet = (studentSpreadsheetRef.current as any).jspreadsheet
      if (!spreadsheet) return

      const data = spreadsheet.getData()
      const rows: StudentImportRow[] = []

      data.forEach((row: any[]) => {
        if (!row[0] || !row[1] || !row[2]) return

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
      validateStudentData(rows).catch(error => {
        console.error('Validation failed:', error)
      })
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
        if (!row[0] || !row[1]) return

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

  const validateStudentData = async (data: StudentImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    const seenStudentIds = new Set<string>()
    let validCount = 0

    // 既存の生徒データを取得
    let existingStudentIds: Set<string> = new Set()
    try {
      const existingStudents = await window.electronAPI.fetchStudents()
      existingStudentIds = new Set(existingStudents.map((s: any) => s.studentId))
    } catch (error) {
      console.warn('既存生徒の取得に失敗しました:', error)
    }

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

      if (seenStudentIds.has(row.studentId)) {
        errors.push(`行${rowNum}: 学籍番号「${row.studentId}」が重複しています`)
        return
      }
      seenStudentIds.add(row.studentId)

      // 既存生徒チェック
      if (existingStudentIds.has(row.studentId)) {
        warnings.push(`行${rowNum}: 学籍番号「${row.studentId}」は既に登録済みです（スキップされます）`)
      }

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

      if (!availableStudentIds.has(row.studentId)) {
        warnings.push(`行${rowNum}: 学籍番号「${row.studentId}」の生徒が見つかりません`)
      }

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
      const skipped: string[] = []

      // 既存の生徒データを取得
      const existingStudents = await window.electronAPI.fetchStudents()
      const existingStudentIds = new Set(existingStudents.map((s: any) => s.studentId))

      for (const row of studentData) {
        // 既存チェック
        if (existingStudentIds.has(row.studentId!)) {
          skipped.push(row.studentId!)
          // 既存の生徒を見つけて追加
          const existingStudent = existingStudents.find((s: any) => s.studentId === row.studentId!)
          if (existingStudent) {
            imported.push(existingStudent)
          }
          continue
        }

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
      
      // スキップされた生徒がいる場合は通知
      if (skipped.length > 0) {
        console.warn('既存の生徒をスキップしました:', skipped)
      }
      
      return imported
    } catch (error) {
      console.error('Student import failed:', error)
      throw error
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
            classRecord.subject || undefined,
            undefined
          )
        }
      }

      const updatedStudents = await window.electronAPI.fetchStudents()
      const finalImportedStudents = updatedStudents.filter((s: any) =>
        importedStudents.some(imported => imported.id === s.id)
      )

      return finalImportedStudents
    } catch (error) {
      console.error('Class assignment failed:', error)
      throw error
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    // Refs
    studentSpreadsheetRef,
    classSpreadsheetRef,
    
    // State
    studentData,
    classAssignmentData,
    studentValidation,
    classValidation,
    isProcessing,
    importedStudents,
    spreadsheetInitialized,
    
    // Helpers
    classMap,
    initializeJSuites,
    
    // Actions
    extractStudentData,
    extractClassAssignmentData,
    validateStudentData,
    validateClassAssignmentData,
    handleImportStudents,
    handleImportClassAssignments,
    
    // Setters
    setSpreadsheetInitialized,
  }
}