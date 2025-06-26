"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Grid3X3, RotateCcw, Upload } from "lucide-react"
import GridHeader from "./GridHeader"
import StudentGridRow from "./StudentGridRow"

// 型定義
interface Student {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: 'participating' | 'expected' | 'absent'
  customOrder?: number | null
}

interface ConvertedFile {
  id: string
  name: string
  type: string
  size: number
  preview?: string
  studentId?: string
  pageNumber: number
  isSelected: boolean
  pageLabel?: string
  buffer: ArrayBuffer
  originalFileName: string
}

// 配置戦略
type PlacementStrategy = 'page-first' | 'student-first' | 'filename-auto'

// セル状態
interface CellState {
  isEnabled: boolean
  isSkipped: boolean
  file?: ConvertedFile
  isFileDisabled?: boolean // 答案画像の無効化フラグ
}

// 生徒状態
interface StudentState {
  isEnabled: boolean
  isSkipped: boolean
  cells: Record<number, CellState>
}

// ページ状態  
interface PageState {
  isEnabled: boolean
  isSkipped: boolean
}

// グリッド状態
interface GridState {
  students: Record<string, StudentState>
  pages: Record<number, PageState>
  placementStrategy: PlacementStrategy
  maxPages: number
}

interface AnswerSheetGridManagerProps {
  projectId: string
  students: Student[]
  files: ConvertedFile[]
  isUploading: boolean
  fileOrder?: 'page-then-student' | 'student-then-page'
  onUpload: (data: Array<{ file: ConvertedFile, studentId: string, pageNumber: number }>) => void
}

export default function AnswerSheetGridManager({
  projectId,
  students,
  files,
  isUploading,
  fileOrder = 'page-then-student',
  onUpload
}: AnswerSheetGridManagerProps) {
  
  // マスター画像の管理
  const [masterImages, setMasterImages] = useState<Array<{id: string, pageNumber: number}>>([])
  const [isLoadingMasterImages, setIsLoadingMasterImages] = useState(true)
  
  // マスター画像を取得
  useEffect(() => {
    const loadMasterImages = async () => {
      try {
        setIsLoadingMasterImages(true)
        const images = await window.electronAPI.getMasterImagesByProjectId(projectId)
        setMasterImages(images || [])
      } catch (error) {
        console.error('Failed to load master images:', error)
        setMasterImages([])
      } finally {
        setIsLoadingMasterImages(false)
      }
    }
    
    if (projectId) {
      loadMasterImages()
    }
  }, [projectId])
  
  // グリッド状態管理
  const [gridState, setGridState] = useState<GridState>(() => {
    // マスター画像のページ数を使用（初期化時は1、後でuseEffectで更新）
    const maxPages = 1
    
    // 初期状態: 全生徒・全ページ有効
    const initialStudents: Record<string, StudentState> = {}
    students.forEach(student => {
      const cells: Record<number, CellState> = {}
      for (let page = 1; page <= maxPages; page++) {
        cells[page] = {
          isEnabled: true,
          isSkipped: false
        }
      }
      
      initialStudents[student.id] = {
        isEnabled: student.status !== 'absent', // 欠席生徒は既定でオフ
        isSkipped: student.status === 'absent',
        cells
      }
    })
    
    const initialPages: Record<number, PageState> = {}
    for (let page = 1; page <= maxPages; page++) {
      initialPages[page] = {
        isEnabled: true,
        isSkipped: false
      }
    }
    
    return {
      students: initialStudents,
      pages: initialPages,
      placementStrategy: 'filename-auto',
      maxPages
    }
  })

  // マスター画像が読み込まれたらグリッド状態を更新
  useEffect(() => {
    if (!isLoadingMasterImages && masterImages.length > 0) {
      const actualMaxPages = Math.max(...masterImages.map(img => img.pageNumber))
      
      setGridState(prevState => {
        // 新しいページ状態を作成
        const newPages: Record<number, PageState> = {}
        for (let page = 1; page <= actualMaxPages; page++) {
          newPages[page] = prevState.pages[page] || {
            isEnabled: true,
            isSkipped: false
          }
        }
        
        // 各生徒のセル状態も更新
        const newStudents: Record<string, StudentState> = {}
        Object.keys(prevState.students).forEach(studentId => {
          const studentState = prevState.students[studentId]
          const newCells: Record<number, CellState> = {}
          
          for (let page = 1; page <= actualMaxPages; page++) {
            newCells[page] = studentState.cells[page] || {
              isEnabled: true,
              isSkipped: false
            }
          }
          
          newStudents[studentId] = {
            ...studentState,
            cells: newCells
          }
        })
        
        return {
          ...prevState,
          students: newStudents,
          pages: newPages,
          maxPages: actualMaxPages
        }
      })
    }
  }, [isLoadingMasterImages, masterImages])


  // 配置戦略変更
  const handleStrategyChange = useCallback((strategy: PlacementStrategy) => {
    setGridState(prev => ({
      ...prev,
      placementStrategy: strategy
    }))
  }, [])

  // 生徒の有効/無効切り替え
  const toggleStudentEnabled = useCallback((studentId: string) => {
    setGridState(prev => ({
      ...prev,
      students: {
        ...prev.students,
        [studentId]: {
          ...prev.students[studentId],
          isEnabled: !prev.students[studentId]?.isEnabled,
          isSkipped: prev.students[studentId]?.isEnabled // 有効→無効の場合はスキップ
        }
      }
    }))
  }, [])

  // ページの有効/無効切り替え
  const togglePageEnabled = useCallback((pageNumber: number) => {
    setGridState(prev => ({
      ...prev,
      pages: {
        ...prev.pages,
        [pageNumber]: {
          ...prev.pages[pageNumber],
          isEnabled: !prev.pages[pageNumber]?.isEnabled,
          isSkipped: prev.pages[pageNumber]?.isEnabled
        }
      }
    }))
  }, [])

  // セルの有効/無効切り替え
  const toggleCellEnabled = useCallback((studentId: string, pageNumber: number) => {
    setGridState(prev => {
      const student = prev.students[studentId]
      if (!student) return prev
      
      const cell = student.cells[pageNumber]
      if (!cell) return prev
      
      return {
        ...prev,
        students: {
          ...prev.students,
          [studentId]: {
            ...student,
            cells: {
              ...student.cells,
              [pageNumber]: {
                ...cell,
                isEnabled: !cell.isEnabled,
                isSkipped: cell.isEnabled
              }
            }
          }
        }
      }
    })
  }, [])

  // ファイルの無効化切り替え（セルは有効のまま）
  const toggleFileDisabled = useCallback((studentId: string, pageNumber: number) => {
    setGridState(prev => {
      const student = prev.students[studentId]
      if (!student) return prev
      
      const cell = student.cells[pageNumber]
      if (!cell) return prev
      
      return {
        ...prev,
        students: {
          ...prev.students,
          [studentId]: {
            ...student,
            cells: {
              ...student.cells,
              [pageNumber]: {
                ...cell,
                isFileDisabled: !cell.isFileDisabled
              }
            }
          }
        }
      }
    })
  }, [])

  // ファイルの削除
  const removeFileFromCell = useCallback((studentId: string, pageNumber: number) => {
    setGridState(prev => {
      const student = prev.students[studentId]
      if (!student) return prev
      
      const cell = student.cells[pageNumber]
      if (!cell) return prev
      
      return {
        ...prev,
        students: {
          ...prev.students,
          [studentId]: {
            ...student,
            cells: {
              ...student.cells,
              [pageNumber]: {
                ...cell,
                file: undefined,
                isFileDisabled: false
              }
            }
          }
        }
      }
    })
  }, [])

  // 順延処理の実行
  const redistributeFiles = useCallback(() => {
    // 無効化されたファイルや削除されたファイルがある場合、
    // 残りのファイルを有効なセルに再配置
    const enabledStudents = students
      .filter(s => gridState.students[s.id]?.isEnabled && !gridState.students[s.id]?.isSkipped)
      .sort((a, b) => {
        // 受験生徒順でソート
        if (a.customOrder !== null && a.customOrder !== undefined && 
            b.customOrder !== null && b.customOrder !== undefined) {
          return a.customOrder - b.customOrder
        }
        if (a.customOrder !== null && a.customOrder !== undefined) return -1
        if (b.customOrder !== null && b.customOrder !== undefined) return 1
        
        const aNumber = a.attendanceNumber
        const bNumber = b.attendanceNumber
        if (aNumber && bNumber) return aNumber - bNumber
        if (aNumber) return -1
        if (bNumber) return 1
        
        return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
      })
    
    const enabledPages = Array.from({length: gridState.maxPages}, (_, i) => i + 1)
      .filter(p => gridState.pages[p]?.isEnabled && !gridState.pages[p]?.isSkipped)
    
    // 有効なファイルを取得
    const availableFiles: ConvertedFile[] = []
    Object.values(gridState.students).forEach(student => {
      Object.values(student.cells).forEach(cell => {
        if (cell.file && !cell.isFileDisabled) {
          availableFiles.push(cell.file)
        }
      })
    })
    
    // 有効なセルのリストを生成
    const validCells: Array<{studentId: string, pageNumber: number}> = []
    
    if (gridState.placementStrategy === 'page-first') {
      enabledPages.forEach(pageNumber => {
        enabledStudents.forEach(student => {
          const cellState = gridState.students[student.id]?.cells[pageNumber]
          if (cellState?.isEnabled && !cellState.isSkipped) {
            validCells.push({ studentId: student.id, pageNumber })
          }
        })
      })
    } else {
      enabledStudents.forEach(student => {
        enabledPages.forEach(pageNumber => {
          const cellState = gridState.students[student.id]?.cells[pageNumber]
          if (cellState?.isEnabled && !cellState.isSkipped) {
            validCells.push({ studentId: student.id, pageNumber })
          }
        })
      })
    }
    
    // 再配置
    const newGridState = { ...gridState }
    
    // すべてのセルをクリア
    Object.keys(newGridState.students).forEach(studentId => {
      Object.keys(newGridState.students[studentId].cells).forEach(pageStr => {
        const pageNumber = parseInt(pageStr)
        if (newGridState.students[studentId].cells[pageNumber]) {
          newGridState.students[studentId].cells[pageNumber].file = undefined
          newGridState.students[studentId].cells[pageNumber].isFileDisabled = false
        }
      })
    })
    
    // ファイルを再配置
    availableFiles.forEach((file, index) => {
      if (index < validCells.length) {
        const cell = validCells[index]
        if (newGridState.students[cell.studentId]?.cells[cell.pageNumber]) {
          newGridState.students[cell.studentId].cells[cell.pageNumber].file = file
        }
      }
    })
    
    setGridState(newGridState)
  }, [students, gridState])

  // 自動配置処理
  const autoPlaceFiles = useCallback(() => {
    setGridState(currentGridState => {
      const enabledStudents = students
        .filter(s => currentGridState.students[s.id]?.isEnabled && !currentGridState.students[s.id]?.isSkipped)
        .sort((a, b) => {
          // 受験生徒順でソート（customOrder優先、その後出席番号順）
          if (a.customOrder !== null && a.customOrder !== undefined && 
              b.customOrder !== null && b.customOrder !== undefined) {
            return a.customOrder - b.customOrder
          }
          if (a.customOrder !== null && a.customOrder !== undefined) return -1
          if (b.customOrder !== null && b.customOrder !== undefined) return 1
          
          const aNumber = a.attendanceNumber
          const bNumber = b.attendanceNumber
          if (aNumber && bNumber) return aNumber - bNumber
          if (aNumber) return -1
          if (bNumber) return 1
          
          return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
        })
      
      const enabledPages = Array.from({length: currentGridState.maxPages}, (_, i) => i + 1)
        .filter(p => currentGridState.pages[p]?.isEnabled && !currentGridState.pages[p]?.isSkipped)
      
      // 有効なセルのリストを生成（配置戦略に基づく順序）
      const validCells: Array<{studentId: string, pageNumber: number}> = []
      
      if (fileOrder === 'page-then-student') {
        // ページ優先: 1ページ目全員 → 2ページ目全員
        enabledPages.forEach(pageNumber => {
          enabledStudents.forEach(student => {
            const cellState = currentGridState.students[student.id]?.cells[pageNumber]
            if (cellState?.isEnabled && !cellState.isSkipped) {
              validCells.push({ studentId: student.id, pageNumber })
            }
          })
        })
      } else if (fileOrder === 'student-then-page') {
        // 生徒優先: 生徒A全ページ → 生徒B全ページ
        enabledStudents.forEach(student => {
          enabledPages.forEach(pageNumber => {
            const cellState = currentGridState.students[student.id]?.cells[pageNumber]
            if (cellState?.isEnabled && !cellState.isSkipped) {
              validCells.push({ studentId: student.id, pageNumber })
            }
          })
        })
      }
      
      // ファイルを順次配置
      const newGridState = { ...currentGridState }
      
      // 既存の配置をクリア
      Object.keys(newGridState.students).forEach(studentId => {
        Object.keys(newGridState.students[studentId].cells).forEach(pageStr => {
          const pageNumber = parseInt(pageStr)
          if (newGridState.students[studentId].cells[pageNumber]) {
            newGridState.students[studentId].cells[pageNumber].file = undefined
          }
        })
      })
      
      // ファイルを順次配置
      files.forEach((file, index) => {
        if (index < validCells.length) {
          const cell = validCells[index]
          if (newGridState.students[cell.studentId]?.cells[cell.pageNumber]) {
            newGridState.students[cell.studentId].cells[cell.pageNumber].file = file
          }
        }
      })
      
      return newGridState
    })
  }, [students, files, fileOrder])

  // ファイルOrder変更時またはファイル追加時に自動配置を実行
  useEffect(() => {
    if (!isLoadingMasterImages && masterImages.length > 0 && files.length > 0) {
      autoPlaceFiles()
    }
  }, [fileOrder, files, isLoadingMasterImages, masterImages, autoPlaceFiles])

  // ファイル名から生徒を推測
  const findStudentByFilename = useCallback((filename: string) => {
    // 学籍番号での一致を試行
    for (const student of students) {
      if (filename.includes(student.studentId)) {
        return student
      }
    }
    
    // 姓名での一致を試行（ひらがな・カタカナ・漢字）
    for (const student of students) {
      const patterns = [
        student.lastName + student.firstName,
        student.lastNameKana + student.firstNameKana,
        // その他のパターンも追加可能
      ]
      
      for (const pattern of patterns) {
        if (filename.includes(pattern)) {
          return student
        }
      }
    }
    
    return null
  }, [students])

  // ファイル名からページ番号を抽出
  const extractPageFromFilename = useCallback((filename: string): number | null => {
    // ページ番号パターンを検索
    const pagePatterns = [
      /page(\d+)/i,
      /p(\d+)/i,
      /_(\d+)\./,
      /(\d+)\.pdf$/i,
      /(\d+)\.png$/i,
      /(\d+)\.jpg$/i,
      /(\d+)\.jpeg$/i,
    ]
    
    for (const pattern of pagePatterns) {
      const match = filename.match(pattern)
      if (match && match[1]) {
        const pageNum = parseInt(match[1])
        if (pageNum > 0 && pageNum <= 50) { // 合理的な範囲内
          return pageNum
        }
      }
    }
    
    return null
  }, [])

  // ファイル名からの自動配置
  const autoPlaceFilesByFilename = useCallback(() => {
    const newGridState = { ...gridState }
    
    // 既存の配置をクリア
    Object.keys(newGridState.students).forEach(studentId => {
      Object.keys(newGridState.students[studentId].cells).forEach(pageStr => {
        const pageNumber = parseInt(pageStr)
        if (newGridState.students[studentId].cells[pageNumber]) {
          newGridState.students[studentId].cells[pageNumber].file = undefined
        }
      })
    })
    
    files.forEach(file => {
      const matchedStudent = findStudentByFilename(file.name)
      const pageNumber = extractPageFromFilename(file.name) || file.pageNumber
      
      if (matchedStudent && pageNumber <= gridState.maxPages) {
        const studentState = newGridState.students[matchedStudent.id]
        const cellState = studentState?.cells[pageNumber]
        
        if (studentState?.isEnabled && !studentState.isSkipped &&
            cellState?.isEnabled && !cellState.isSkipped) {
          cellState.file = file
        }
      }
    })
    
    setGridState(newGridState)
  }, [files, students, gridState, findStudentByFilename, extractPageFromFilename])

  // アップロード実行
  const handleUpload = useCallback(() => {
    const uploadData: Array<{ file: ConvertedFile, studentId: string, pageNumber: number }> = []
    
    // 有効なセルからアップロードデータを生成
    students.forEach(student => {
      const studentState = gridState.students[student.id]
      if (!studentState?.isEnabled || studentState.isSkipped) return
      
      Object.entries(studentState.cells).forEach(([pageStr, cellState]) => {
        const pageNumber = parseInt(pageStr)
        if (!cellState.isEnabled || cellState.isSkipped || !cellState.file) return
        
        uploadData.push({
          file: cellState.file,
          studentId: student.id,
          pageNumber
        })
      })
    })
    
    onUpload(uploadData)
  }, [students, gridState, onUpload])

  // 統計計算
  const stats = useMemo(() => {
    const enabledStudents = Object.values(gridState.students).filter(s => s.isEnabled && !s.isSkipped).length
    const enabledPages = Object.values(gridState.pages).filter(p => p.isEnabled && !p.isSkipped).length
    const totalCells = enabledStudents * enabledPages
    
    let filledCells = 0
    Object.values(gridState.students).forEach(student => {
      if (!student.isEnabled || student.isSkipped) return
      Object.values(student.cells).forEach(cell => {
        if (cell.isEnabled && !cell.isSkipped && cell.file) {
          filledCells++
        }
      })
    })
    
    return {
      enabledStudents,
      enabledPages,
      totalCells,
      filledCells,
      completionRate: totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0
    }
  }, [gridState])

  // ローディング中の表示
  if (isLoadingMasterImages) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                模範解答のページ情報を読み込み中...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // マスター画像がない場合
  if (!masterImages || masterImages.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                模範解答がアップロードされていません。<br />
                まず「模範解答アップロード」ページで模範解答をアップロードしてください。
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* 表形式グリッド */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              生徒と答案の対応
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={redistributeFiles} variant="outline" size="sm" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                順延処理
              </Button>
              <Badge variant="outline">
                {stats.filledCells}/{stats.totalCells} セル
              </Badge>
              <Badge variant={stats.completionRate === 100 ? "default" : "secondary"}>
                {stats.completionRate}% 完了
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-96 border rounded">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <GridHeader
                  maxPages={gridState.maxPages}
                  pageStates={gridState.pages}
                  onTogglePage={togglePageEnabled}
                />
              </TableHeader>
              <TableBody>
                {students.map(student => (
                  <StudentGridRow
                    key={student.id}
                    student={student}
                    maxPages={gridState.maxPages}
                    studentState={gridState.students[student.id]}
                    pageStates={gridState.pages}
                    onToggleStudent={() => toggleStudentEnabled(student.id)}
                    onToggleCell={(pageNumber) => toggleCellEnabled(student.id, pageNumber)}
                    onToggleFileDisabled={(pageNumber) => toggleFileDisabled(student.id, pageNumber)}
                    onRemoveFile={(pageNumber) => removeFileFromCell(student.id, pageNumber)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* アップロードボタン */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {stats.filledCells}個の答案画像をアップロードします
            </div>
            <Button
              onClick={handleUpload}
              disabled={isUploading || stats.filledCells === 0}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? "アップロード中..." : `${stats.filledCells}件をアップロード`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}