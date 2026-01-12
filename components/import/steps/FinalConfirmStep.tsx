"use client"

import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  Download,
  GraduationCap,
  Layers,
  Pencil,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  CategoryIdIntegrationConfig,
  PreMatchingResult,
} from "@/types/projectArchive.types"

interface FinalConfirmStepProps {
  wizard: UseImportWizardReturn
  onExecute: () => void
}

/**
 * カテゴリ別のサマリーを計算
 */
function calculateCategorySummary(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig,
  updateDecisions: Record<string, boolean>
): {
  linked: number
  new: number
  skipped: number
  idChangeToImport: number
  updated: number
  kept: number
} {
  let linked = 0
  let newCount = 0
  let skipped = 0
  let idChangeToImport = 0
  let updated = 0
  let kept = 0

  // 更新判断を集計するヘルパー
  const countUpdateDecision = (importId: string) => {
    const decision = updateDecisions[importId]
    if (decision === true) {
      updated++
    } else if (decision === false) {
      kept++
    }
    // undefinedの場合はデフォルトでupdated（チェックボックスのデフォルトがtrue）
    else {
      updated++
    }
  }

  // ID一致（自動で紐づく）
  for (const match of preMatch.byId) {
    linked++
    countUpdateDecision(match.importId)
  }

  // 個別の決定を確認するヘルパー関数
  const getDecision = (importId: string) => {
    return config.decisions.find((d) => d.importId === importId)
  }

  // 学籍番号一致
  if (preMatch.byStudentNumber) {
    for (const match of preMatch.byStudentNumber) {
      const decision = getDecision(match.importId)

      if (
        config.strategy === "by_student_number" ||
        config.strategy === "by_name"
      ) {
        // デフォルトはsame_person
        if (!decision || decision.decisionType === "same_person") {
          linked++
          countUpdateDecision(match.importId)
          if (decision?.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else if (config.strategy === "all_new") {
        if (!decision || decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else {
        // individual
        if (decision?.decisionType === "same_person") {
          linked++
          countUpdateDecision(match.importId)
          if (decision.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision?.decisionType === "skip") {
          skipped++
        } else {
          newCount++
        }
      }
    }
  }

  // 名前一致
  if (preMatch.byName) {
    for (const match of preMatch.byName) {
      // byStudentNumberで既に処理済みの場合はスキップ
      const alreadyProcessed = preMatch.byStudentNumber?.some(
        (m) => m.importId === match.importId
      )
      if (alreadyProcessed) continue

      const decision = getDecision(match.importId)

      if (config.strategy === "by_name") {
        if (!decision || decision.decisionType === "same_person") {
          linked++
          countUpdateDecision(match.importId)
          if (decision?.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else if (config.strategy === "all_new") {
        if (!decision || decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else {
        // individual or by_student_number
        if (decision?.decisionType === "same_person") {
          linked++
          countUpdateDecision(match.importId)
          if (decision.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision?.decisionType === "skip") {
          skipped++
        } else {
          newCount++
        }
      }
    }
  }

  // どれにも一致しない
  for (const item of preMatch.noMatch) {
    const decision = getDecision(item.importId)

    if (decision?.decisionType === "skip") {
      skipped++
    } else {
      // デフォルトは新規作成
      newCount++
    }
  }

  return { linked, new: newCount, skipped, idChangeToImport, updated, kept }
}

/**
 * 最終確認ステップ
 *
 * インポート内容のサマリーを表示し、実行の確認を行う
 */
export function FinalConfirmStep({ wizard, onExecute }: FinalConfirmStepProps) {
  const { state, goBack } = wizard
  const { fileOverviewData, idIntegrationConfig, manifest, updateDecisions } =
    state

  // サマリーを計算
  const studentSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.student,
        idIntegrationConfig.student,
        updateDecisions
      )
    : null

  const classSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.class,
        idIntegrationConfig.class,
        updateDecisions
      )
    : null

  const subtotalGroupSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.subtotalGroup,
        idIntegrationConfig.subtotalGroup,
        updateDecisions
      )
    : null

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      {/* ヘッダー */}
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <ClipboardList className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">インポート内容の最終確認</h3>
        <p className="text-muted-foreground">以下の内容でインポートします</p>
      </div>

      {/* サマリー */}
      <div className="mb-8 w-full max-w-md space-y-4">
        {/* 生徒 */}
        {studentSummary && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="text-muted-foreground h-5 w-5" />
                <h4 className="font-medium">生徒</h4>
              </div>
              <ul className="space-y-1 text-sm">
                {studentSummary.linked > 0 && (
                  <>
                    <li className="text-muted-foreground flex items-center gap-2">
                      <span className="text-green-500">•</span>
                      既存データと紐づけ: {studentSummary.linked}名
                      {studentSummary.idChangeToImport > 0 && (
                        <span className="text-xs text-amber-600">
                          （{studentSummary.idChangeToImport}名のIDを変更）
                        </span>
                      )}
                    </li>
                    {(studentSummary.updated > 0 ||
                      studentSummary.kept > 0) && (
                      <li className="text-muted-foreground ml-4 flex items-center gap-2 text-xs">
                        {studentSummary.updated > 0 && (
                          <span className="text-purple-500">
                            情報を更新: {studentSummary.updated}名
                          </span>
                        )}
                        {studentSummary.updated > 0 &&
                          studentSummary.kept > 0 && <span>/</span>}
                        {studentSummary.kept > 0 && (
                          <span className="text-gray-500">
                            既存を維持: {studentSummary.kept}名
                          </span>
                        )}
                      </li>
                    )}
                  </>
                )}
                {studentSummary.new > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <span className="text-blue-500">•</span>
                    新しく登録: {studentSummary.new}名
                  </li>
                )}
                {studentSummary.skipped > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    スキップ: {studentSummary.skipped}名
                  </li>
                )}
                {studentSummary.linked === 0 &&
                  studentSummary.new === 0 &&
                  studentSummary.skipped === 0 && (
                    <li className="text-muted-foreground">データなし</li>
                  )}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 学級 */}
        {classSummary && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="text-muted-foreground h-5 w-5" />
                <h4 className="font-medium">学級</h4>
              </div>
              <ul className="space-y-1 text-sm">
                {classSummary.linked > 0 && (
                  <>
                    <li className="text-muted-foreground flex items-center gap-2">
                      <span className="text-green-500">•</span>
                      既存データと紐づけ: {classSummary.linked}クラス
                      {classSummary.idChangeToImport > 0 && (
                        <span className="text-xs text-amber-600">
                          （{classSummary.idChangeToImport}クラスのIDを変更）
                        </span>
                      )}
                    </li>
                    {(classSummary.updated > 0 || classSummary.kept > 0) && (
                      <li className="text-muted-foreground ml-4 flex items-center gap-2 text-xs">
                        {classSummary.updated > 0 && (
                          <span className="text-purple-500">
                            情報を更新: {classSummary.updated}クラス
                          </span>
                        )}
                        {classSummary.updated > 0 && classSummary.kept > 0 && (
                          <span>/</span>
                        )}
                        {classSummary.kept > 0 && (
                          <span className="text-gray-500">
                            既存を維持: {classSummary.kept}クラス
                          </span>
                        )}
                      </li>
                    )}
                  </>
                )}
                {classSummary.new > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <span className="text-blue-500">•</span>
                    新しく登録: {classSummary.new}クラス
                  </li>
                )}
                {classSummary.skipped > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    スキップ: {classSummary.skipped}クラス
                  </li>
                )}
                {classSummary.linked === 0 &&
                  classSummary.new === 0 &&
                  classSummary.skipped === 0 && (
                    <li className="text-muted-foreground">データなし</li>
                  )}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 小計グループ */}
        {subtotalGroupSummary && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="text-muted-foreground h-5 w-5" />
                <h4 className="font-medium">小計グループ</h4>
              </div>
              <ul className="space-y-1 text-sm">
                {subtotalGroupSummary.linked > 0 && (
                  <>
                    <li className="text-muted-foreground flex items-center gap-2">
                      <span className="text-green-500">•</span>
                      既存データと紐づけ: {subtotalGroupSummary.linked}グループ
                      {subtotalGroupSummary.idChangeToImport > 0 && (
                        <span className="text-xs text-amber-600">
                          （{subtotalGroupSummary.idChangeToImport}
                          グループのIDを変更）
                        </span>
                      )}
                    </li>
                    {(subtotalGroupSummary.updated > 0 ||
                      subtotalGroupSummary.kept > 0) && (
                      <li className="text-muted-foreground ml-4 flex items-center gap-2 text-xs">
                        {subtotalGroupSummary.updated > 0 && (
                          <span className="text-purple-500">
                            情報を更新: {subtotalGroupSummary.updated}グループ
                          </span>
                        )}
                        {subtotalGroupSummary.updated > 0 &&
                          subtotalGroupSummary.kept > 0 && <span>/</span>}
                        {subtotalGroupSummary.kept > 0 && (
                          <span className="text-gray-500">
                            既存を維持: {subtotalGroupSummary.kept}グループ
                          </span>
                        )}
                      </li>
                    )}
                  </>
                )}
                {subtotalGroupSummary.new > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <span className="text-blue-500">•</span>
                    新しく登録: {subtotalGroupSummary.new}グループ
                  </li>
                )}
                {subtotalGroupSummary.skipped > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    スキップ: {subtotalGroupSummary.skipped}グループ
                  </li>
                )}
                {subtotalGroupSummary.linked === 0 &&
                  subtotalGroupSummary.new === 0 &&
                  subtotalGroupSummary.skipped === 0 && (
                    <li className="text-muted-foreground">データなし</li>
                  )}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 採点データ */}
        {manifest && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardCheck className="text-muted-foreground h-5 w-5" />
                <h4 className="font-medium">採点データ</h4>
              </div>
              <ul className="space-y-1 text-sm">
                <li className="text-muted-foreground flex items-center gap-2">
                  <span className="text-blue-500">•</span>
                  採点結果: {manifest.counts.scores}件
                </li>
                {manifest.counts.annotations > 0 && (
                  <li className="text-muted-foreground flex items-center gap-2">
                    <Pencil className="h-3 w-3" />
                    書き込み: {manifest.counts.annotations}件
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 警告 */}
      <Card className="mb-8 w-full max-w-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            注意: インポート後は元に戻せません
          </p>
        </CardContent>
      </Card>

      {/* ボタン */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={goBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻って確認
        </Button>
        <Button onClick={onExecute} size="lg" className="gap-2 px-8">
          <Download className="h-5 w-5" />
          インポート実行
        </Button>
      </div>
    </div>
  )
}
