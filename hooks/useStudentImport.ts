import { useState } from "react"

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
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
    attendanceNumber?: number | null
    notes?: string | null
    class: {
      id: string
      name: string
      classCode?: string | null
    }
  }>
}

interface StudentImportRow {
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: string
  isDuplicate?: boolean
}

interface ClassAssignmentRow {
  studentId: string
  classCode: string
}

interface ValidationResult {
  valid: number
  errors: string[]
  warnings: string[]
}

export function useStudentImport(existingClasses: ClassWithMemberships[]) {
  const [studentData, setStudentData] = useState<StudentImportRow[]>([
    { studentId: '', lastName: '', firstName: '', lastNameKana: '', firstNameKana: '', enrollmentYear: '' },
  ])
  
  const [classAssignmentData, setClassAssignmentData] = useState<ClassAssignmentRow[]>([
    { studentId: '', classCode: '' },
  ])
  
  const [studentValidation, setStudentValidation] = useState<ValidationResult>({ 
    valid: 0, errors: [], warnings: [] 
  })
  const [classValidation, setClassValidation] = useState<ValidationResult>({ 
    valid: 0, errors: [], warnings: [] 
  })
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

  const handleStudentDataChange = (data: StudentImportRow[]) => {
    // 重複チェックとフラグ設定
    markDuplicateStudents(data).then(updatedData => {
      setStudentData(updatedData)
      validateStudentData(updatedData).catch(error => {
        console.error('Validation failed:', error)
      })
    })
  }

  const markDuplicateStudents = async (data: StudentImportRow[]) => {
    // 既存の生徒データを取得
    let existingStudentIds: Set<string> = new Set()
    try {
      const existingStudents = await window.electronAPI.fetchStudents()
      existingStudentIds = new Set(existingStudents.map((s: any) => s.studentId))
    } catch (error) {
      console.warn('既存生徒の取得に失敗しました:', error)
    }

    // 重複フラグを設定
    return data.map(row => ({
      ...row,
      isDuplicate: existingStudentIds.has(row.studentId?.trim() || '')
    }))
  }

  const handleClassAssignmentDataChange = (data: ClassAssignmentRow[]) => {
    setClassAssignmentData(data)
    validateClassAssignmentData(data)
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

    const filteredData = data.filter(row => 
      row.studentId?.trim() || row.lastName?.trim() || row.firstName?.trim()
    )

    filteredData.forEach((row, index) => {
      const rowNum = index + 1

      if (!row.studentId?.trim()) {
        errors.push(`行${rowNum}: 学籍番号が入力されていません`)
        return
      }
      if (!row.lastName?.trim()) {
        errors.push(`行${rowNum}: 姓が入力されていません`)
        return
      }
      if (!row.firstName?.trim()) {
        errors.push(`行${rowNum}: 名が入力されていません`)
        return
      }

      if (seenStudentIds.has(row.studentId.trim())) {
        errors.push(`行${rowNum}: 学籍番号「${row.studentId}」が重複しています`)
        return
      }
      seenStudentIds.add(row.studentId.trim())

      // 既存生徒チェック
      if (existingStudentIds.has(row.studentId.trim())) {
        warnings.push(`行${rowNum}: 学籍番号「${row.studentId}」は既に登録済みです（上書きされます）`)
      }

      if (!row.lastNameKana?.trim()) {
        warnings.push(`行${rowNum}: 姓カナが入力されていません`)
      }
      if (!row.firstNameKana?.trim()) {
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

    const availableStudentIds = new Set(
      studentData
        .filter(s => s.studentId?.trim())
        .map(s => s.studentId.trim())
    )

    const filteredData = data.filter(row => 
      row.studentId?.trim() || row.classCode?.trim()
    )

    filteredData.forEach((row, index) => {
      const rowNum = index + 1

      if (!row.studentId?.trim()) {
        errors.push(`行${rowNum}: 学籍番号が入力されていません`)
        return
      }
      if (!row.classCode?.trim()) {
        errors.push(`行${rowNum}: クラスコードが入力されていません`)
        return
      }

      if (!availableStudentIds.has(row.studentId.trim())) {
        warnings.push(`行${rowNum}: 学籍番号「${row.studentId}」の生徒が見つかりません`)
      }

      if (!classMap.has(row.classCode.trim())) {
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

      // 既存の生徒データを取得
      const existingStudents = await window.electronAPI.fetchStudents()
      const existingStudentIds = new Set(existingStudents.map((s: any) => s.studentId))

      const validStudentData = studentData.filter(row => 
        row.studentId?.trim() && row.lastName?.trim() && row.firstName?.trim()
      )

      for (const row of validStudentData) {
        const studentId = row.studentId.trim()
        
        const studentData = {
          studentId,
          lastName: row.lastName.trim(),
          firstName: row.firstName.trim(),
          lastNameKana: row.lastNameKana?.trim() || '',
          firstNameKana: row.firstNameKana?.trim() || '',
          enrollmentYear: row.enrollmentYear ? parseInt(row.enrollmentYear) : undefined,
        }

        // 既存チェック - 上書きまたは新規作成
        if (existingStudentIds.has(studentId)) {
          const existingStudent = existingStudents.find((s: any) => s.studentId === studentId)
          if (existingStudent) {
            // 既存生徒を更新
            const updatedStudent = await window.electronAPI.updateStudent(existingStudent.id, studentData)
            imported.push(updatedStudent)
          }
        } else {
          // 新規生徒を作成
          const newStudent = await window.electronAPI.createStudent(studentData)
          imported.push(newStudent)
        }
      }

      setImportedStudents(imported)
      
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

      const validClassAssignmentData = classAssignmentData.filter(row => 
        row.studentId?.trim() && row.classCode?.trim()
      )

      for (const row of validClassAssignmentData) {
        const student = studentMap.get(row.studentId.trim())
        const classRecord = classMap.get(row.classCode.trim())
        
        if (student && classRecord) {
          await window.electronAPI.addStudentToClass(
            student.id,
            classRecord.id,
            new Date(),
            undefined, // attendanceNumber
            undefined  // notes
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
    // State
    studentData,
    classAssignmentData,
    studentValidation,
    classValidation,
    isProcessing,
    importedStudents,
    
    // Helpers
    classMap,
    
    // Actions
    handleStudentDataChange,
    handleClassAssignmentDataChange,
    validateStudentData,
    validateClassAssignmentData,
    handleImportStudents,
    handleImportClassAssignments,
  }
}