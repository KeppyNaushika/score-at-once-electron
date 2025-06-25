"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Download, FileText, FileSpreadsheet, Users, Search, Info, CheckSquare, Square } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import ScoringMarkSettings, { ScoringMarkConfig, defaultScoringMarkConfig } from "@/components/export/ScoringMarkSettings"
import ExportProgressModal from "@/components/export/ExportProgressModal"

// 生徒の状態を表す型
type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型
interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: {
    id: string
    attendanceNumber?: number | null
    class: {
      id: string
      name: string
    }
  }[]
  status: StudentStatus
  isInProject: boolean
  customOrder?: number | null
}

// 出力オプションの型
interface ExportOptions {
  includeScoredAnswers: boolean
  includeIndividualReports: boolean
  includeGradingData: boolean
  format: 'pdf' | 'excel'
  selectedStudents: string[]
}

export default function ExportPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all")
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeScoredAnswers: true,
    includeIndividualReports: false,
    includeGradingData: false,
    format: 'pdf',
    selectedStudents: []
  })
  const [isExporting, setIsExporting] = useState(false)
  const [scoringMarkConfig, setScoringMarkConfig] = useState<ScoringMarkConfig>(defaultScoringMarkConfig)
  
  // プログレス状態
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<'processing' | 'completed' | 'error'>('processing')
  const [exportStep, setExportStep] = useState('')
  const [exportError, setExportError] = useState('')
  const [exportOutputPath, setExportOutputPath] = useState('')
  const [totalSteps, setTotalSteps] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // データの取得
  useEffect(() => {
    setLoading(true)
    loadStudentData().finally(() => setLoading(false))
  }, [projectId])

  // プログレスリスナーの設定
  useEffect(() => {
    const removeListener = window.electronAPI.onExportProgress((progress) => {
      setExportProgress(progress.percentage)
      setExportStep(progress.step)
      setCurrentStepIndex(Math.floor(progress.percentage / 10)) // 大まかな段階
      setTotalSteps(10) // 大まかな総段階数
    })

    return removeListener
  }, [])

  const loadStudentData = async () => {
    try {
      const studentsResult = await window.electronAPI.getStudentsForProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        // 受験生徒をcustomOrder順で並び替え
        const sortedStudents = [...studentsResult.students].sort((a: any, b: any) => {
          if (a.customOrder !== null && a.customOrder !== undefined && 
              b.customOrder !== null && b.customOrder !== undefined) {
            return a.customOrder - b.customOrder
          }
          if (a.customOrder !== null && a.customOrder !== undefined) return -1
          if (b.customOrder !== null && b.customOrder !== undefined) return 1
          return 0
        })
        setStudents(sortedStudents)
        
        // デフォルトで受験状態の生徒を選択
        const participatingStudents = sortedStudents
          .filter(s => s.status === 'participating')
          .map(s => s.id)
        setSelectedStudents(new Set(participatingStudents))
      }
    } catch (error) {
      console.error('Failed to load student data:', error)
    }
  }

  // フィルタリングされた生徒リスト
  const filteredStudents = students.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`
    const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm)
    
    const matchesStatus = statusFilter === "all" || student.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // 生徒選択の処理
  const handleStudentToggle = (studentId: string, checked: boolean) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(studentId)
      } else {
        newSet.delete(studentId)
      }
      return newSet
    })
  }

  // 全選択の処理
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)))
    } else {
      setSelectedStudents(new Set())
    }
  }

  // 採点済み答案PDFの出力
  const exportScoredAnswers = async () => {
    if (selectedStudents.size === 0) {
      alert('出力する生徒を選択してください。')
      return
    }

    // プログレス状態をリセット
    setExportProgress(0)
    setExportStatus('processing')
    setExportStep('保存場所を選択中...')
    setExportError('')
    setExportOutputPath('')
    setCurrentStepIndex(0)
    setTotalSteps(10)
    setShowProgressModal(true)
    setIsExporting(true)

    try {
      // 保存場所選択と処理開始を並行実行
      const result = await window.electronAPI.exportScoredAnswersPDF({
        projectId,
        selectedStudentIds: Array.from(selectedStudents),
        scoringMarkConfig
      })

      if (result.success && result.outputPath) {
        setExportStatus('completed')
        setExportOutputPath(result.outputPath)
        setExportProgress(100)
        setExportStep('完了しました')
        
        // 2秒後にモーダルを自動フェードアウト
        setTimeout(() => {
          setShowProgressModal(false)
        }, 2000)
      } else {
        throw new Error(result.error || '出力に失敗しました')
      }
    } catch (error) {
      console.error('Export failed:', error)
      setExportStatus('error')
      setExportError(error instanceof Error ? error.message : '不明なエラー')
    } finally {
      setIsExporting(false)
    }
  }

  // 個人成績表PDFの出力（将来実装予定）
  const exportIndividualReports = async () => {
    alert('個人成績表PDF出力機能は現在開発中です。')
  }

  // 採点データ一覧Excelの出力
  const exportGradingData = async () => {
    if (selectedStudents.size === 0) {
      alert('出力する生徒を選択してください。')
      return
    }

    setIsExporting(true)
    try {
      const result = await window.electronAPI.exportGradingDataExcel({
        projectId,
        selectedStudentIds: Array.from(selectedStudents)
      })

      if (result.success && result.outputPath) {
        alert(`採点データExcelの出力が完了しました。\n保存先: ${result.outputPath}`)
      } else {
        throw new Error(result.error || '出力に失敗しました')
      }
    } catch (error) {
      console.error('Excel export failed:', error)
      alert(`出力に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setIsExporting(false)
    }
  }

  // 統計情報
  const totalStudents = students.length
  const selectedCount = selectedStudents.size
  const participatingStudents = students.filter(s => s.status === 'participating').length

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="結果の出力" description="" helpButton={helpButton}>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px]" align="start" side="bottom">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-base">結果の出力</h3>
                  </div>
                  <p className="text-sm text-muted-foreground pl-7">
                    採点結果を様々な形式で出力できます。出力する生徒と形式を選択してください。
                  </p>
                </div>

                <div className="space-y-3 pl-7">
                  <div className="border rounded-lg p-3 text-sm bg-blue-50 border-blue-200 text-blue-800">
                    <strong>出力形式</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li><strong>採点済み答案PDF</strong>: 採点マークが書き込まれた答案</li>
                      <li><strong>個人成績表PDF</strong>: 生徒ごとの詳細な成績票（開発中）</li>
                      <li><strong>採点データ一覧Excel</strong>: 全生徒の採点データ（開発中）</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-3 text-sm bg-orange-50 border-orange-200 text-orange-800">
                    <strong>ヒント:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>受験状態の生徒がデフォルトで選択されます</li>
                      <li>欠席者も含めて出力できます</li>
                      <li>大量の出力には時間がかかる場合があります</li>
                    </ul>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={() => router.push(`/projects/${projectId}`)}>
            プロジェクトに戻る
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 space-y-6 overflow-hidden p-6">
        {/* 統計カード */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                総生徒数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                受験者数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {participatingStudents}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                選択中
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 出力対象の選択 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                出力対象の選択
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 検索とフィルタ */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="生徒名・学籍番号で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(value: "all" | StudentStatus) => setStatusFilter(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="状態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全て</SelectItem>
                      <SelectItem value="participating">受験</SelectItem>
                      <SelectItem value="expected">見込</SelectItem>
                      <SelectItem value="absent">欠席</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm font-medium">
                    表示中の生徒をすべて選択 ({filteredStudents.length}人)
                  </Label>
                </div>
              </div>

              <Separator />

              {/* 生徒リスト */}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={`student-${student.id}`}
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={(checked) => 
                        handleStudentToggle(student.id, checked as boolean)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`student-${student.id}`} className="text-sm font-medium cursor-pointer">
                          {student.lastName} {student.firstName}
                        </Label>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          student.status === 'participating' 
                            ? 'bg-green-100 text-green-800'
                            : student.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {student.status === 'participating' ? '受験' : 
                           student.status === 'absent' ? '欠席' : '見込'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {student.studentId} • {student.memberships[0]?.class.name || '未所属'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 出力オプション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                出力オプション
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 採点済み答案PDF（実装済み） */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium">採点済み答案PDF</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  採点マークが書き込まれた答案をPDFで出力
                </p>
                <Button 
                  onClick={exportScoredAnswers}
                  disabled={selectedStudents.size === 0}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <LoadingSpinner className="mr-2" />
                      出力中...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      採点済み答案PDFを出力
                    </>
                  )}
                </Button>
              </div>

              <Separator />

              {/* 個人成績表PDF（将来実装予定） */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <h4 className="font-medium text-gray-600">個人成績表PDF</h4>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">開発中</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  生徒ごとの詳細な成績票をPDFで出力
                </p>
                <Button 
                  onClick={exportIndividualReports}
                  disabled={true}
                  variant="outline"
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  個人成績表PDFを出力
                </Button>
              </div>

              <Separator />

              {/* 採点データ一覧Excel（実装済み） */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium">採点データ一覧Excel</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  全生徒の採点データを表形式でExcel出力（点数一覧・正誤一覧）
                </p>
                <Button 
                  onClick={exportGradingData}
                  disabled={selectedStudents.size === 0}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <LoadingSpinner className="mr-2" />
                      出力中...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      採点データExcelを出力
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 採点マーク設定 */}
          <ScoringMarkSettings
            config={scoringMarkConfig}
            onChange={setScoringMarkConfig}
          />
        </div>
      </div>

      {/* プログレスモーダル */}
      <ExportProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progress={exportProgress}
        status={exportStatus}
        currentStep={exportStep}
        totalSteps={totalSteps}
        currentStepIndex={currentStepIndex}
        error={exportError}
        outputPath={exportOutputPath}
      />
    </div>
  )
}