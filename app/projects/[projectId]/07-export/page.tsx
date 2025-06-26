"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { useExportPage } from "./hooks/useExportPage"
import { StudentSelectionCard } from "./components/StudentSelectionCard"
import { ExportOptionsCard } from "./components/ExportOptionsCard"
import ExportProgressModal from "@/components/export/ExportProgressModal"

export default function ExportPage() {
  const router = useRouter()
  const { helpButton } = usePageHelp()

  const {
    project,
    students,
    availableClasses,
    loading,
    searchTerm,
    setSearchTerm,
    selectedClasses,
    setSelectedClasses,
    selectedStatuses,
    setSelectedStatuses,
    selectedStudents,
    setSelectedStudents,
    exportOptions,
    setExportOptions,
    scoringMarkConfig,
    setScoringMarkConfig,
    showProgressModal,
    setShowProgressModal,
    exportProgress,
    setExportProgress,
    isExporting,
    setIsExporting,
  } = useExportPage()

  const handleExport = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    setIsExporting(true)
    setShowProgressModal(true)
    setExportProgress(0)

    try {
      const selectedStudentIds = Array.from(selectedStudents)
      
      // Choose the appropriate export method based on options
      const result = exportOptions.format === 'pdf' 
        ? await window.electronAPI.exportScoredAnswersPDF({
            projectId: project.id,
            selectedStudentIds,
            scoringMarkConfig: {
              position: scoringMarkConfig.position,
              size: scoringMarkConfig.markSize,
              showTransparent: scoringMarkConfig.useTransparent
            }
          })
        : await window.electronAPI.exportGradingDataExcel({
            projectId: project.id,
            selectedStudentIds
          })

      if (result.success) {
        setExportProgress(100)
        setTimeout(() => {
          setShowProgressModal(false)
          alert(`出力が完了しました。\n保存先: ${result.outputPath}`)
        }, 1000)
      } else {
        alert(`出力に失敗しました: ${result.error}`)
        setShowProgressModal(false)
      }
    } catch (error) {
      console.error("Export error:", error)
      alert("出力中にエラーが発生しました")
      setShowProgressModal(false)
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="結果出力"
        description="採点結果をPDFまたはExcelファイルとして出力します"
        helpButton={helpButton}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudentSelectionCard
          students={students}
          availableClasses={availableClasses}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedClasses={selectedClasses}
          setSelectedClasses={setSelectedClasses}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          selectedStudents={selectedStudents}
          setSelectedStudents={setSelectedStudents}
        />

        <ExportOptionsCard
          exportOptions={exportOptions}
          setExportOptions={setExportOptions}
          scoringMarkConfig={scoringMarkConfig}
          setScoringMarkConfig={setScoringMarkConfig}
        />
      </div>

      {/* 出力実行 */}
      <Card>
        <CardHeader>
          <CardTitle>出力実行</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {selectedStudents.size}人の生徒を選択しています
              </p>
              <p className="text-xs text-muted-foreground">
                {exportOptions.includeScoredAnswers && "採点済み答案PDF、"}
                {exportOptions.includeGradingData && "採点データExcel、"}
                {exportOptions.includeIndividualReports && "個人成績表PDF"}
                を出力します
              </p>
            </div>
            <Button 
              onClick={handleExport}
              disabled={selectedStudents.size === 0 || isExporting}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              出力開始
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* プログレスモーダル */}
      <ExportProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progress={exportProgress}
        status={isExporting ? 'processing' : 'completed'}
        currentStep="出力中..."
        totalSteps={1}
        currentStepIndex={0}
      />
    </div>
  )
}