"use client"

import { Scan } from "lucide-react"
import { useCallback } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { OMRCellConfig, OMRChoiceConfig } from "@/types/omr.types"

/** 選択肢ラベルプリセット */
const CHOICE_LABEL_PRESETS: { value: string; labels: string[] }[] = [
  {
    value: "katakana",
    labels: ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ"],
  },
  {
    value: "alphabet",
    labels: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  },
  {
    value: "circled",
    labels: ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"],
  },
  {
    value: "number",
    labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },
]

interface OMRCellConfigFormProps {
  config?: OMRCellConfig
  onChange: (config: OMRCellConfig | undefined) => void
}

export function OMRCellConfigForm({
  config,
  onChange,
}: OMRCellConfigFormProps) {
  const enabled = !!config

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        onChange({
          type: "choice",
          numChoices: 4,
          labels: CHOICE_LABEL_PRESETS[0].labels.slice(0, 4),
          correctAnswers: [],
          layout: "horizontal",
        })
      } else {
        onChange(undefined)
      }
    },
    [onChange]
  )

  const handleTypeChange = useCallback(
    (type: string) => {
      if (type === "choice") {
        onChange({
          type: "choice",
          numChoices: 4,
          labels: CHOICE_LABEL_PRESETS[0].labels.slice(0, 4),
          correctAnswers:
            config?.type === "choice" ? config.correctAnswers : [],
          layout: "horizontal",
        })
      } else {
        onChange({
          type: "handwritten-digit",
          numDigits: 2,
          correctAnswer:
            config?.type === "handwritten-digit"
              ? config.correctAnswer
              : undefined,
        })
      }
    },
    [config, onChange]
  )

  const choiceConfig = config?.type === "choice" ? config : null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scan className="text-muted-foreground h-3.5 w-3.5" />
          <Label className="text-muted-foreground text-xs">OMR自動認識</Label>
        </div>
        <Switch
          className="scale-75"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && config && (
        <div className="border-muted ml-2 space-y-1.5 border-l-2 pl-3">
          {/* 認識タイプ */}
          <div className="flex items-center gap-1.5">
            <Label className="text-muted-foreground min-w-[3rem] text-xs">
              種類
            </Label>
            <Select value={config.type} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="choice">選択式</SelectItem>
                <SelectItem value="handwritten-digit">手書き数字</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 選択式設定 */}
          {choiceConfig && (
            <ChoiceConfigFields config={choiceConfig} onChange={onChange} />
          )}

          {/* 手書き数字設定 */}
          {config.type === "handwritten-digit" && (
            <DigitConfigFields config={config} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  )
}

function ChoiceConfigFields({
  config,
  onChange,
}: {
  config: OMRChoiceConfig
  onChange: (config: OMRCellConfig) => void
}) {
  return (
    <>
      {/* 選択肢数 */}
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground min-w-[3rem] text-xs">
          選択肢数
        </Label>
        <input
          type="number"
          className="border-input h-7 w-14 [appearance:textfield] rounded border px-1.5 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={config.numChoices}
          min={2}
          max={10}
          onChange={(e) => {
            const n = Math.max(2, Math.min(10, Number(e.target.value) || 4))
            const currentPreset = CHOICE_LABEL_PRESETS.find(
              (p) => p.labels[0] === config.labels[0]
            )
            const labels = (
              currentPreset?.labels ?? CHOICE_LABEL_PRESETS[0].labels
            ).slice(0, n)
            onChange({
              ...config,
              numChoices: n,
              labels,
              correctAnswers: config.correctAnswers.filter((i) => i < n),
            })
          }}
        />
      </div>

      {/* ラベルプリセット */}
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground min-w-[3rem] text-xs">
          ラベル
        </Label>
        <Select
          value={
            CHOICE_LABEL_PRESETS.find((p) => p.labels[0] === config.labels[0])
              ?.value ?? "katakana"
          }
          onValueChange={(preset) => {
            const p = CHOICE_LABEL_PRESETS.find((pr) => pr.value === preset)
            if (p) {
              onChange({
                ...config,
                labels: p.labels.slice(0, config.numChoices),
              })
            }
          }}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHOICE_LABEL_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.labels.slice(0, 4).join(",")}...
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 配置方向 */}
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground min-w-[3rem] text-xs">
          配置
        </Label>
        <Select
          value={config.layout}
          onValueChange={(v: "horizontal" | "vertical") =>
            onChange({ ...config, layout: v })
          }
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="horizontal">横</SelectItem>
            <SelectItem value="vertical">縦</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 正解選択 */}
      <div className="flex items-start gap-1.5">
        <Label className="text-muted-foreground mt-1 min-w-[3rem] text-xs">
          正解
        </Label>
        <div className="flex flex-wrap gap-1">
          {config.labels.map((label, idx) => {
            const isSelected = config.correctAnswers.includes(idx)
            return (
              <button
                key={idx}
                type="button"
                className={`h-6 min-w-[1.5rem] rounded border px-1 text-xs ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted text-muted-foreground hover:border-primary/50"
                }`}
                onClick={() => {
                  const next = isSelected
                    ? config.correctAnswers.filter((i) => i !== idx)
                    : [...config.correctAnswers, idx]
                  onChange({ ...config, correctAnswers: next })
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function DigitConfigFields({
  config,
  onChange,
}: {
  config: OMRCellConfig & { type: "handwritten-digit" }
  onChange: (config: OMRCellConfig) => void
}) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground min-w-[3rem] text-xs">
          桁数
        </Label>
        <input
          type="number"
          className="border-input h-7 w-14 [appearance:textfield] rounded border px-1.5 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={config.numDigits}
          min={1}
          max={5}
          onChange={(e) =>
            onChange({
              ...config,
              numDigits: Math.max(1, Math.min(5, Number(e.target.value) || 2)),
            })
          }
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground min-w-[3rem] text-xs">
          正解
        </Label>
        <input
          className="border-input h-7 w-20 rounded border px-1.5 text-center text-xs"
          value={config.correctAnswer ?? ""}
          placeholder="42"
          onChange={(e) =>
            onChange({
              ...config,
              correctAnswer: e.target.value || undefined,
            })
          }
        />
      </div>
    </>
  )
}
