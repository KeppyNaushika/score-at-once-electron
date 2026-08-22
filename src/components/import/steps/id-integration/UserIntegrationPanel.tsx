"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type { ExistingItemInfo } from "@/types/examArchive.types"

/**
 * 「新しく作る」を表す選択肢の値。
 *
 * 利用者の id は uuid なので、この文字列と衝突することはない。
 */
const CREATE_NEW_USER = "__create_new_user__"

interface UserIntegrationPanelProps {
  wizard: UseImportWizardReturn
}

/** 決めるべき採点者1人ぶんの行 */
interface GraderRow {
  importId: string
  displayLabel: string
  /** 利用者名が一致した既存の利用者（居なければ undefined） */
  suggestedExistingId: string | undefined
  /** なぜ判断が要るのか（照合理由 / 一致なし） */
  matchNote: string
}

/**
 * 採点者（利用者）の統合パネル
 *
 * **答えは「既存の利用者に結ぶ」か「新しく作る」の2つだけ。**「取り込まない」は無い ——
 * 採点行は採点者を親に持つので、結ばずに置くと行が親を失う。
 *
 * ID を付け替える選択（このPC／ファイル）も出さない。利用者の id を書き換える経路は
 * 無く、採点行はどちらの id を選んでも同じ人を指すので、選ばせる意味が無い。
 */
export function UserIntegrationPanel({ wizard }: UserIntegrationPanelProps) {
  const { state, updateIdIntegrationDecision } = wizard
  const overview = state.fileOverviewData?.user
  if (!overview) return null

  const graderRows: GraderRow[] = [
    ...(overview.byName ?? []).map((match) => ({
      importId: match.importId,
      displayLabel: match.displayLabel,
      suggestedExistingId: match.existingId,
      matchNote: match.matchReason,
    })),
    ...overview.noMatch.map((item) => ({
      importId: item.importId,
      displayLabel: item.displayLabel,
      suggestedExistingId: undefined,
      matchNote: "このPCに同じ利用者なし",
    })),
  ]

  if (graderRows.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての採点者が自動で紐づきました
          </p>
        </CardContent>
      </Card>
    )
  }

  const existingUsers: ExistingItemInfo[] = overview.allExistingItems ?? []
  const decisionByImportId = new Map(
    state.idIntegrationConfig.user.decisions.map((decision) => [
      decision.importId,
      decision,
    ])
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            判断が必要な採点者が{graderRows.length}名います
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            読み込んだ採点は、ここで選んだ利用者の採点として登録されます。取り込んだ人のものにはしません（誰が付けた点かが分からなくなるため）。
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {graderRows.map((graderRow) => {
              const decision = decisionByImportId.get(graderRow.importId)
              // 決めていないときの既定は照合結果に従う（利用者名が一致すればその人、
              // 一致しなければ新しく作る）。画面の見た目と実際の取り込みを揃える
              const selectedValue = decision
                ? decision.decisionType === "same_person" && decision.existingId
                  ? decision.existingId
                  : CREATE_NEW_USER
                : (graderRow.suggestedExistingId ?? CREATE_NEW_USER)

              return (
                <div key={graderRow.importId} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      {graderRow.displayLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {graderRow.matchNote}
                    </span>
                  </div>
                  <Select
                    value={selectedValue}
                    onValueChange={(value) =>
                      updateIdIntegrationDecision("user", graderRow.importId, {
                        importId: graderRow.importId,
                        decisionType:
                          value === CREATE_NEW_USER
                            ? "create_new"
                            : "same_person",
                        existingId:
                          value === CREATE_NEW_USER ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CREATE_NEW_USER}>
                        新しい利用者として登録する
                      </SelectItem>
                      {existingUsers.map((existingUser) => (
                        <SelectItem
                          key={existingUser.id}
                          value={existingUser.id}
                        >
                          {existingUser.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
