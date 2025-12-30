"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  StudentMatchingMethod,
  ClassMatchingMethod,
  UserMatchingMethod,
  SubtotalGroupMatchingMethod,
} from "@/types/projectArchive.types"
import {
  Users,
  School,
  UserCircle,
  Layers,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MatchingConfigStepProps {
  wizard: UseImportWizardReturn
}

interface MatchingCardProps<T extends string> {
  icon: React.ReactNode
  title: string
  description: string
  value: T
  onChange: (value: T) => void
  options: Array<{
    value: T
    label: string
    description: string
    recommended?: boolean
  }>
}

function MatchingCard<T extends string>({
  icon,
  title,
  description,
  value,
  onChange,
  options,
}: MatchingCardProps<T>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </CardTitle>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as T)}
          className="gap-2"
        >
          {options.map((option) => (
            <Label
              key={option.value}
              htmlFor={`${title}-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                value === option.value
                  ? "bg-primary/5 border-primary"
                  : "hover:bg-muted/50 border-transparent bg-transparent"
              )}
            >
              <RadioGroupItem
                id={`${title}-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{option.label}</span>
                  {option.recommended && (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
                      <Sparkles className="h-3 w-3" />
                      推奨
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {option.description}
                </p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

export function MatchingConfigStep({ wizard }: MatchingConfigStepProps) {
  const { state, updateMatchingConfig, detectConflicts } = wizard

  const handleNext = async () => {
    await detectConflicts()
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-semibold">マッチング設定</h3>
        <p className="text-muted-foreground text-sm">
          インポートデータと既存データをどのように照合するかを設定します。
        </p>
      </div>

      <div className="grid gap-4">
        {/* 生徒マッチング */}
        <MatchingCard<StudentMatchingMethod>
          icon={<Users className="h-4 w-4" />}
          title="生徒"
          description="生徒データの照合方法"
          value={state.matchingConfig.student}
          onChange={(value) => updateMatchingConfig("student", value)}
          options={[
            {
              value: "studentId",
              label: "学籍番号で照合",
              description: "学籍番号が一致する生徒を同一と見なします",
              recommended: true,
            },
            {
              value: "uuid",
              label: "IDで照合",
              description: "データベースIDが一致する生徒を同一と見なします",
            },
            {
              value: "name",
              label: "氏名で照合",
              description: "姓と名が一致する生徒を同一と見なします",
            },
          ]}
        />

        {/* 学級マッチング */}
        <MatchingCard<ClassMatchingMethod>
          icon={<School className="h-4 w-4" />}
          title="学級"
          description="学級データの照合方法"
          value={state.matchingConfig.class}
          onChange={(value) => updateMatchingConfig("class", value)}
          options={[
            {
              value: "name",
              label: "名前で照合",
              description: "学級名が一致するものを同一と見なします",
              recommended: true,
            },
            {
              value: "uuid",
              label: "IDで照合",
              description: "データベースIDが一致するものを同一と見なします",
            },
          ]}
        />

        {/* ユーザーマッチング */}
        <MatchingCard<UserMatchingMethod>
          icon={<UserCircle className="h-4 w-4" />}
          title="ユーザー"
          description="採点者データの照合方法"
          value={state.matchingConfig.user}
          onChange={(value) => updateMatchingConfig("user", value)}
          options={[
            {
              value: "username",
              label: "ユーザー名で照合",
              description: "ユーザー名が一致するものを同一と見なします",
              recommended: true,
            },
            {
              value: "uuid",
              label: "IDで照合",
              description: "データベースIDが一致するものを同一と見なします",
            },
          ]}
        />

        {/* 小計グループマッチング */}
        <MatchingCard<SubtotalGroupMatchingMethod>
          icon={<Layers className="h-4 w-4" />}
          title="小計グループ"
          description="小計グループの照合方法"
          value={state.matchingConfig.subtotalGroup}
          onChange={(value) => updateMatchingConfig("subtotalGroup", value)}
          options={[
            {
              value: "name",
              label: "名前で照合",
              description: "グループ名が一致するものを同一と見なします",
              recommended: true,
            },
            {
              value: "uuid",
              label: "IDで照合",
              description: "データベースIDが一致するものを同一と見なします",
            },
          ]}
        />
      </div>

      {/* 次へボタン */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleNext}
          disabled={state.isProcessing}
          className="gap-2"
        >
          {state.isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              競合を検出中...
            </>
          ) : (
            <>
              競合を確認
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
