"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"
import { ExportOptionsCard } from "@/components/projects/08-export/components/ExportOptionsCard"
import ExportProgressModal from "@/components/projects/08-export/components/ExportProgressModal"
import ExportWarningModal from "@/components/projects/08-export/components/ExportWarningModal"
import { useExportPage } from "@/components/projects/08-export/hooks/useExportPage"
import { StudentSelectionCard } from "@/components/projects/08-export/components/StudentSelectionCard"
import { useState } from "react"

export default function ExportPage() {
  const { helpButton } = usePageHelp()
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningData, setWarningData] = useState({
    noScoringData: [] as string[],
    unscored: [] as string[],
    missingPartialScore: [] as string[],
  })

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
    exportStatus,
    setExportStatus,
    currentStep,
    setCurrentStep,
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
    setExportStatus("processing")
    setCurrentStep("初期化中...")

    try {
      const selectedStudentIds = Array.from(selectedStudents)

      const result = await window.electronAPI.exportScoredAnswersPDF({
        projectId: project.id,
        selectedStudentIds,
        pdfOrientation: exportOptions.pdfOrientation,
        scoringMarkConfig: {
          ...scoringMarkConfig,
          position: scoringMarkConfig.markPosition,
          size: scoringMarkConfig.markSize,
          showTransparent: scoringMarkConfig.useTransparent,
        },
      })

      if (result.success) {
        setExportProgress(100)
        setExportStatus("completed")
        setCurrentStep("完了しました")
      } else {
        setExportStatus("error")
        setCurrentStep(`エラー: ${result.error}`)
      }
    } catch (error) {
      console.error("Export error:", error)
      setExportStatus("error")
      setCurrentStep("出力中にエラーが発生しました")
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
      } else if (result.warnings) {
        // 警告がある場合は警告モーダルを表示
        setWarningData(result.warnings)
        setShowWarningModal(true)
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

  const handleContinueExport = async () => {
    setShowWarningModal(false)
    setIsExporting(true)

    try {
      const selectedStudentIds = Array.from(selectedStudents)

      const result = await window.electronAPI.exportGradingDataExcel({
        projectId: project.id,
        selectedStudentIds,
        forceExport: true, // 警告を無視して強制実行
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
    <div className="flex h-full flex-col">
      <PageHeader
        title="結果出力"
        description="採点結果をPDFまたはExcelファイルとして出力します"
        helpButton={helpButton}
      />

      <div className="container mx-auto space-y-6 px-4 py-6">
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
          status={exportStatus}
          currentStep={currentStep}
        />

        {/* 警告モーダル */}
        <ExportWarningModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onContinue={handleContinueExport}
          warnings={warningData}
        />
      </div>
    </div>
  )
}
