"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { useExportPage } from "../../../../components/projects/07-export/hooks/useExportPage"
import { StudentSelectionCard } from "../../../../components/projects/07-export/StudentSelectionCard"
import { ExportOptionsCard } from "../../../../components/projects/07-export/ExportOptionsCard"
import ExportProgressModal from "../../../../components/projects/07-export/ExportProgressModal"

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

  const handleExportScoredAnswers = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    setIsExporting(true)
    setShowProgressModal(true)
    setExportProgress(0)

    try {
      const selectedStudentIds = Array.from(selectedStudents)

      const result = await window.electronAPI.exportScoredAnswersPDF({
        projectId: project.id,
        selectedStudentIds,
        scoringMarkConfig: {
          ...scoringMarkConfig,
          position: scoringMarkConfig.markPosition,
          size: scoringMarkConfig.markSize,
          showTransparent: scoringMarkConfig.useTransparent,
        },
      })

      if (result.success) {
        setExportProgress(100)
        setTimeout(() => {
          setShowProgressModal(false)
          alert(
            `採点済み答案PDFの出力が完了しました。\n保存先: ${result.outputPath}`,
          )
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

  const handleExportGradingData = async () => {
    if (selectedStudents.size === 0) {
      alert("出力する生徒を選択してください")
      return
    }

    setIsExporting(true)

    try {
      const selectedStudentIds = Array.from(selectedStudents)

      const result = await window.electronAPI.exportGradingDataExcel({
        projectId: project.id,
        selectedStudentIds,
      })

      if (result.success) {
        alert(
          `採点データExcelの出力が完了しました。\n保存先: ${result.outputPath}`,
        )
      } else {
        alert(`出力に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error("Export error:", error)
      alert("出力中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportIndividualReports = async () => {
    alert("個人成績表PDF出力機能は現在開発中です。")
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <PageHeader
        title="結果出力"
        description="採点結果をPDFまたはExcelファイルとして出力します"
        helpButton={helpButton}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StudentSelectionCard
          students={students} // 受験生徒順（customOrder）でソート済み
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
          <div className="space-y-4">
            <div>
              <p className="text-muted-foreground text-sm">
                {selectedStudents.size}人の生徒を選択しています
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <Button
                onClick={handleExportScoredAnswers}
                disabled={selectedStudents.size === 0 || isExporting}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                採点済み答案PDF
              </Button>
              <Button
                onClick={handleExportGradingData}
                disabled={selectedStudents.size === 0 || isExporting}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                採点データExcel
              </Button>
              <Button
                onClick={handleExportIndividualReports}
                disabled={true}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                個人成績表PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* プログレスモーダル */}
      <ExportProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progress={exportProgress}
        status={isExporting ? "processing" : "completed"}
        currentStep="出力中..."
        totalSteps={1}
        currentStepIndex={0}
      />
    </div>
  )
}
