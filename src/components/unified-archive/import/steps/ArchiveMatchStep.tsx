"use client"

import { Layers, School, Settings, UserCog, Users } from "lucide-react"
import { type ReactNode, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ArchiveMatchTable } from "@/electron-src/lib/import/unified-archive/archiveMatchCandidates"

import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"
import type { ArchiveMatchCandidate } from "../types"
import { ArchiveMatchRow } from "./ArchiveMatchRow"
import { StepNextButton } from "./StepNextButton"

const MATCH_TABS: {
  table: ArchiveMatchTable
  label: string
  icon: ReactNode
}[] = [
  { table: "Student", label: "生徒", icon: <Users className="h-4 w-4" /> },
  { table: "Classroom", label: "学級", icon: <School className="h-4 w-4" /> },
  {
    table: "SubtotalGroup",
    label: "小計グループ",
    icon: <Layers className="h-4 w-4" />,
  },
  { table: "User", label: "利用者", icon: <UserCog className="h-4 w-4" /> },
]

const isMatchTable = (value: string): value is ArchiveMatchTable =>
  MATCH_TABS.some((matchTab) => matchTab.table === value)

/** 照合の決定のキー（main の archiveRowKey と同じ形） */
const matchRowKey = (matchCandidate: ArchiveMatchCandidate): string =>
  `${matchCandidate.table}:${matchCandidate.archiveId}`

/**
 * 3. 紐づけ。id で一致しなかった生徒・学級・小計グループ・利用者を、学籍番号・名前で
 * 当てた候補に「同じもの / 新規 / 取り込まない」で結ぶ（設計 §7.1 の3）
 */
export function ArchiveMatchStep({
  wizard,
}: {
  wizard: UnifiedArchiveImportWizardState
}) {
  const { opened, matchDecisions, setMatchDecision, action, goNext } = wizard
  const candidatesByTable = new Map<
    ArchiveMatchTable,
    ArchiveMatchCandidate[]
  >()
  for (const matchCandidate of opened?.matchCandidates ?? []) {
    const tableCandidates = candidatesByTable.get(matchCandidate.table) ?? []
    tableCandidates.push(matchCandidate)
    candidatesByTable.set(matchCandidate.table, tableCandidates)
  }
  const firstTableWithRows =
    MATCH_TABS.find((matchTab) => candidatesByTable.has(matchTab.table))
      ?.table ?? "Student"
  const [activeTable, setActiveTable] =
    useState<ArchiveMatchTable>(firstTableWithRows)

  const nextButton = (
    <StepNextButton
      onClick={() => void goNext()}
      isProcessing={wizard.isProcessing}
    />
  )

  if (candidatesByTable.size === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/20">
          <Settings className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">
          すべてのデータが自動で紐づきました
        </h3>
        <p className="max-w-md text-center text-muted-foreground">
          生徒・学級・小計グループ・利用者は、すべて id
          でこのパソコンのものと一致しました。
        </p>
        {nextButton}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Settings className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">データの紐づけ</h3>
        <p className="mx-auto max-w-lg text-muted-foreground">
          id
          で一致しなかったものを、このパソコンのものと紐づけるか選んでください。
        </p>
      </div>

      <Tabs
        value={activeTable}
        onValueChange={(value) => {
          if (isMatchTable(value)) setActiveTable(value)
        }}
        className="flex-1"
      >
        <TabsList className="mb-4 grid w-full grid-cols-4">
          {MATCH_TABS.map((matchTab) => {
            const rowCount = candidatesByTable.get(matchTab.table)?.length ?? 0
            return (
              <TabsTrigger
                key={matchTab.table}
                value={matchTab.table}
                className="gap-2"
              >
                {matchTab.icon}
                {matchTab.label}
                {rowCount > 0 && <Badge variant="secondary">{rowCount}</Badge>}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {MATCH_TABS.map((matchTab) => {
          const tableCandidates = candidatesByTable.get(matchTab.table) ?? []
          const withCandidates = tableCandidates.filter(
            (matchCandidate) => matchCandidate.candidates.length > 0
          )
          const withoutCandidates = tableCandidates.filter(
            (matchCandidate) => matchCandidate.candidates.length === 0
          )
          const renderRow = (matchCandidate: ArchiveMatchCandidate) => {
            const rowKey = matchRowKey(matchCandidate)
            return (
              <ArchiveMatchRow
                key={rowKey}
                matchCandidate={matchCandidate}
                decision={matchDecisions[rowKey] ?? { kind: "new" }}
                action={action}
                onDecisionChange={(decision) =>
                  setMatchDecision(rowKey, decision)
                }
              />
            )
          }
          return (
            <TabsContent
              key={matchTab.table}
              value={matchTab.table}
              className="mt-0 space-y-4"
            >
              {tableCandidates.length === 0 && (
                <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                  <CardContent className="p-4 text-center text-green-700 dark:text-green-300">
                    すべての{matchTab.label}が自動で紐づきました
                  </CardContent>
                </Card>
              )}
              {withCandidates.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">
                    このパソコンに候補があるもの（{withCandidates.length}件）
                  </h4>
                  {withCandidates.map(renderRow)}
                </section>
              )}
              {withoutCandidates.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">
                    このパソコンに同じものが無いもの（{withoutCandidates.length}
                    件）
                  </h4>
                  {withoutCandidates.map(renderRow)}
                </section>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {nextButton}
    </div>
  )
}
