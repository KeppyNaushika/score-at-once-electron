"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ClassMatchingMethod,
  StudentMatchingMethod,
} from "@/types/projectArchive.types"
import { ChevronDown, FileText, Loader2, Search } from "lucide-react"
import { useState } from "react"

interface MatchingSettingsStepProps {
  wizard: UseImportWizardReturn
}

/**
 * 照合設定ステップ
 *
 * IDで照合できなかった場合の二次照合方法を設定
 */
export function MatchingSettingsStep({ wizard }: MatchingSettingsStepProps) {
  const { state, updateMatchingConfig, performMatching } = wizard
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleNext = async () => {
    await performMatching()
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <Search className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">同じ人かどうかの判定方法</h3>
        <p className="text-muted-foreground max-w-lg">
          インポートする生徒・学級と、既存のデータを照合します。
          <br />
          何で「同じ人」と判断するか選んでください。
        </p>
      </div>

      {/* アーカイブ情報 */}
      {state.manifest && (
        <Card className="bg-muted/50 mb-6">
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="text-muted-foreground h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">{state.manifest.projectName}</p>
              <p className="text-muted-foreground text-sm">
                生徒 {state.manifest.counts.students}名 ・ 採点結果{" "}
                {state.manifest.counts.scores}件
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* メイン設定 */}
      <div className="flex-1 space-y-4">
        {/* 説明カード */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>💡 ヒント:</strong>{" "}
              同じパソコンでエクスポートしたファイルをインポートする場合は、
              自動的に同じ人として紐づけられます。
              別のパソコンからのデータは、以下で選んだ方法で判定します。
            </p>
          </CardContent>
        </Card>

        {/* 生徒の判定方法 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">生徒の判定方法</CardTitle>
            <p className="text-muted-foreground text-sm">
              何が同じなら「同じ生徒」と判断しますか？
            </p>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.matchingConfig.student}
              onValueChange={(value) =>
                updateMatchingConfig("student", value as StudentMatchingMethod)
              }
            >
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value="studentNumber"
                    id="student-studentNumber"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="student-studentNumber"
                      className="cursor-pointer font-medium"
                    >
                      学籍番号が同じなら同一人物（推奨）
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      学籍番号で判定します。一般的にはこれを選んでください
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="name" id="student-name" />
                  <div className="flex-1">
                    <Label
                      htmlFor="student-name"
                      className="cursor-pointer font-medium"
                    >
                      氏名（姓・名）が同じなら同一人物
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      姓と名の両方が一致したら同じ人と判断します
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="none" id="student-none" />
                  <div className="flex-1">
                    <Label
                      htmlFor="student-none"
                      className="cursor-pointer font-medium"
                    >
                      判定しない（全て新規登録）
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      既存の生徒とは紐づけず、全て新しい生徒として登録します
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 学級の判定方法 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">学級の判定方法</CardTitle>
            <p className="text-muted-foreground text-sm">
              何が同じなら「同じ学級」と判断しますか？
            </p>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.matchingConfig.class}
              onValueChange={(value) =>
                updateMatchingConfig("class", value as ClassMatchingMethod)
              }
            >
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="name" id="class-name" />
                  <div className="flex-1">
                    <Label
                      htmlFor="class-name"
                      className="cursor-pointer font-medium"
                    >
                      学級名が同じなら同一学級（推奨）
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      学級名で判定します。一般的にはこれを選んでください
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="none" id="class-none" />
                  <div className="flex-1">
                    <Label
                      htmlFor="class-none"
                      className="cursor-pointer font-medium"
                    >
                      判定しない（全て新規登録）
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      既存の学級とは紐づけず、全て新しい学級として登録します
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 詳細オプション */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="text-muted-foreground w-full justify-between"
            >
              <span>詳細オプション（通常は変更不要）</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">
                  採点者と小計グループは、それぞれユーザー名とグループ名で照合されます。
                  <br />
                  この設定は通常変更する必要はありません。
                </p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* 次へボタン */}
      <div className="mt-6 flex justify-center">
        <Button
          onClick={handleNext}
          disabled={state.isProcessing}
          size="lg"
          className="gap-2 px-8"
        >
          {state.isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              照合中...
            </>
          ) : (
            <>照合して次へ</>
          )}
        </Button>
      </div>
    </div>
  )
}
