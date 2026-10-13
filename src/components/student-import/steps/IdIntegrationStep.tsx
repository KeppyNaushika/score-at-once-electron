"use client"

import { ChevronRight, CircleCheck } from "lucide-react"
import { useState } from "react"

import { resolveIdIntegrationRows } from "@/components/import/idIntegrationRows"
import { ClassroomIntegrationPanel } from "@/components/import/steps/id-integration/ClassroomIntegrationPanel"
import { StudentIntegrationPanel } from "@/components/import/steps/id-integration/StudentIntegrationPanel"
import type { IdIntegrationWizard } from "@/components/import/steps/id-integration/types"
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

  // 全てID一致で自動照合できる場合はファストパス。学籍番号一致と氏名一致は重なるので行で数える
  const studentNeedsDecision = resolveIdIntegrationRows(
    studentResult,
    state.idIntegrationConfig.student
  ).length
  const classroomNeedsDecision = resolveIdIntegrationRows(
    classroomResult,
    state.idIntegrationConfig.classroom
  ).length

  const allAutoMatched =
    studentNeedsDecision === 0 && classroomNeedsDecision === 0

  if (allAutoMatched) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CircleCheck className="h-10 w-10 text-green-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">
            すべてのデータが自動で紐づきました
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            同じPCで作成されたデータのため、手動の設定は不要です
          </p>
        </div>
        <Button onClick={goToNextStep} className="gap-2">
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // 照合の画面（試験の取り込みと共通）が使う形に揃える。生徒の取り込みには小計グループが無い
  const integrationWizard: IdIntegrationWizard = {
    state: {
      fileOverviewData: {
        student: studentResult,
        classroom: classroomResult,
      },
      idIntegrationConfig: state.idIntegrationConfig,
    },
    updateIdIntegrationDecision: (category, importId, decision) => {
      if (category === "student" || category === "classroom") {
        wizard.updateIdIntegrationDecision(category, importId, decision)
      }
    },
    batchUpdateIdIntegrationDecisions: (
      category,
      items,
      decisionType,
      idChoice
    ) => {
      if (category === "student" || category === "classroom") {
        wizard.batchUpdateIdIntegrationDecisions(
          category,
          items,
          decisionType,
          idChoice
        )
      }
    },
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">データの紐づけ</h3>
        <p className="mt-1 text-sm text-muted-foreground">
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
            wizard={integrationWizard}
            onStrategyChange={(strategy) =>
              wizard.updateIdIntegrationConfig("student", { strategy })
            }
          />
        </TabsContent>

        <TabsContent value="classroom" className="mt-4">
          <ClassroomIntegrationPanel
            wizard={integrationWizard}
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
