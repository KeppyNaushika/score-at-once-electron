"use client"

import { CheckCircle2, ChevronRight } from "lucide-react"
import { useState } from "react"

import { ClassroomIntegrationPanel } from "@/components/import/steps/id-integration/ClassroomIntegrationPanel"
import { StudentIntegrationPanel } from "@/components/import/steps/id-integration/StudentIntegrationPanel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"

interface IdIntegrationStepProps {
  wizard: StudentImportWizard
}

export function IdIntegrationStep({ wizard }: IdIntegrationStepProps) {
  const { state, goToNextStep } = wizard
  const [activeTab, setActiveTab] = useState<string>("student")

  if (!state.fileOverviewData) return null

  const { student: studentResult, classroom: classroomResult } =
    state.fileOverviewData

  // 全てID一致で自動照合できる場合はファストパス
  const studentNeedsDecision =
    (studentResult.byStudentNumber?.length ?? 0) +
    (studentResult.byName?.length ?? 0) +
    studentResult.noMatch.length
  const classroomNeedsDecision =
    (classroomResult.byName?.length ?? 0) + classroomResult.noMatch.length

  const allAutoMatched =
    studentNeedsDecision === 0 && classroomNeedsDecision === 0

  if (allAutoMatched) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">
            すべてのデータが自動で紐づきました
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            同じパソコンで作成されたデータのため、手動の設定は不要です
          </p>
        </div>
        <Button onClick={goToNextStep} className="gap-2">
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // 既存のパネルに渡す互換オブジェクトを作成
  // StudentIntegrationPanel / ClassroomIntegrationPanel は
  // examArchive の useImportWizard を想定しているため、アダプターを作成
  const wizardAdapter = {
    state: {
      ...state,
      idIntegrationConfig: {
        ...state.idIntegrationConfig,
        subtotalGroup: { strategy: "by_name" as const, decisions: [] },
      },
      fileOverviewData: {
        student: studentResult,
        classroom: classroomResult,
        subtotalGroup: { byId: [], noMatch: [] },
      },
    },
    updateIdIntegrationConfig: (
      category: string,
      config: Record<string, unknown>
    ) => {
      if (category === "student" || category === "classroom") {
        wizard.updateIdIntegrationConfig(category, config)
      }
    },
    updateIdIntegrationDecision: (
      category: string,
      importId: string,
      decision: Record<string, unknown>
    ) => {
      if (category === "student" || category === "classroom") {
        wizard.updateIdIntegrationDecision(category, importId, decision)
      }
    },
    batchUpdateIdIntegrationDecisions: (
      category: string,
      idChoice: "use_import_id" | "use_existing_id"
    ) => {
      if (category === "student" || category === "classroom") {
        wizard.batchUpdateIdIntegrationDecisions(category, idChoice)
      }
    },
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">データの紐づけ</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          ファイル内のデータをこのPCのデータとどう紐づけるか設定してください
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="student">
            生徒
            {studentNeedsDecision > 0 && (
              <span className="ml-1 text-xs">({studentNeedsDecision})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="classroom">
            学級
            {classroomNeedsDecision > 0 && (
              <span className="ml-1 text-xs">({classroomNeedsDecision})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="student" className="mt-4">
          <StudentIntegrationPanel
            wizard={wizardAdapter as never}
            onStrategyChange={(strategy) =>
              wizard.updateIdIntegrationConfig("student", { strategy })
            }
          />
        </TabsContent>

        <TabsContent value="classroom" className="mt-4">
          <ClassroomIntegrationPanel
            wizard={wizardAdapter as never}
            onStrategyChange={(strategy) =>
              wizard.updateIdIntegrationConfig("classroom", { strategy })
            }
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-center pt-4">
        <Button onClick={goToNextStep} className="gap-2">
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
