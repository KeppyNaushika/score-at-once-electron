"use client"

import { Scan } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
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

/**
 * 選択肢ラベルプリセット
 *
 * 共通テストで実際に使用される全パターンを網羅:
 *
 * ■ 数学（数値解答欄）
 *   - 0〜9: 数値解答（全年度共通）
 *   - −: 負の符号（令和7年度〜、符号はマイナスのみ）
 *   - ±: 符号（〜令和6年度の数学①で使用、令和7年度〜廃止）
 *   - a,b,c,d: 文字選択（〜令和6年度の数学②で使用、令和7年度〜廃止）
 *
 * ■ 全科目共通（選択肢番号）
 *   - ①〜⑨: 選択肢番号（4〜9択、科目・問題により異なる）
 *
 * その他汎用プリセット・カスタム入力も対応。
 */
const CHOICE_LABEL_PRESETS: {
  value: string
  displayName: string
  labels: string[]
  /** 共通テストで使用されるプリセットかどうか */
  isCommonTest?: boolean
}[] = [
  // ── 共通テスト準拠：数学 数値解答欄 ──
  {
    value: "digit",
    displayName: "0〜9（数値解答）",
    labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    isCommonTest: true,
  },
  {
    value: "digit-minus",
    displayName: "0〜9,−（数値+符号）",
    labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "−"],
    isCommonTest: true,
  },
  {
    value: "plus-minus",
    displayName: "+,−（符号）",
    labels: ["+", "−"],
    isCommonTest: true,
  },
  {
    value: "plus-minus-zero",
    displayName: "+,−,0（符号+ゼロ）",
    labels: ["+", "−", "0"],
    isCommonTest: true,
  },
  // ── 共通テスト準拠：全科目 選択肢番号 ──
  {
    value: "circled",
    displayName: "①〜⑨（選択肢番号）",
    labels: ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"],
    isCommonTest: true,
  },
  // ── 共通テスト準拠：旧課程・特定科目 ──
  {
    value: "alphabet-lower",
    displayName: "a〜d（数学②〜R6）",
    labels: ["a", "b", "c", "d"],
    isCommonTest: true,
  },
  {
    value: "plus-minus-pm",
    displayName: "+,−,±（数学①〜R6）",
    labels: ["+", "−", "±"],
    isCommonTest: true,
  },
  // ── 汎用プリセット ──
  {
    value: "katakana",
    displayName: "ア〜コ",
    labels: ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ"],
  },
  {
    value: "alphabet-upper",
    displayName: "A〜J",
    labels: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  },
  {
    value: "number",
    displayName: "1〜10",
    labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },
  {
    value: "true-false",
    displayName: "正,誤",
    labels: ["正", "誤"],
  },
  {
    value: "maru-batsu",
    displayName: "○,×",
    labels: ["○", "×"],
  },
  {
    value: "custom",
    displayName: "カスタム（コンマ区切り）",
    labels: [],
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

  const choiceConfig = config?.type === "choice" ? config : null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scan className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">OMR自動認識</Label>
        </div>
        <Switch
          className="scale-75"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && config && (
        <div className="ml-2 space-y-1.5 border-l-2 border-muted pl-3">
          {/* 選択式設定 */}
          {choiceConfig && (
            <ChoiceConfigFields config={choiceConfig} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  )
}

/** 現在のラベルに一致するプリセットを検出 */
function detectPreset(labels: string[]): string {
  for (const preset of CHOICE_LABEL_PRESETS) {
    if (preset.value === "custom") continue
    if (
      preset.labels.length >= labels.length &&
      labels.every((label, i) => preset.labels[i] === label)
    ) {
      return preset.value
    }
  }
  return "custom"
}

function ChoiceConfigFields({
  config,
  onChange,
}: {
  config: OMRChoiceConfig
  onChange: (config: OMRCellConfig) => void
}) {
  const detectedPresetValue = useMemo(
    () => detectPreset(config.labels),
    [config.labels]
  )

  // 「カスタム」を明示的に選択中かどうか。
  // detectPreset はラベルがどのプリセットにも一致しない場合のみ "custom" を返すため、
  // プリセット由来のラベルからカスタムへ切り替えるにはこのフラグが必要。
  const [forceCustom, setForceCustom] = useState(
    () => detectedPresetValue === "custom"
  )
  const isCustom = forceCustom || detectedPresetValue === "custom"
  const currentPresetValue = isCustom ? "custom" : detectedPresetValue

  // カスタム入力用のローカルステート
  const [customInput, setCustomInput] = useState(() =>
    isCustom ? config.labels.join(",") : ""
  )

  return (
    <>
      {/* ラベルプリセット */}
      <div className="flex items-center gap-1.5">
        <Label className="min-w-12 text-xs text-muted-foreground">ラベル</Label>
        <Select
          value={currentPresetValue}
          onValueChange={(preset) => {
            if (preset === "custom") {
              setForceCustom(true)
              setCustomInput(config.labels.join(","))
              return
            }
            setForceCustom(false)
            const matchedPreset = CHOICE_LABEL_PRESETS.find(
              (presetOption) => presetOption.value === preset
            )
            if (matchedPreset) {
              const labels = matchedPreset.labels.slice(
                0,
                Math.max(2, matchedPreset.labels.length)
              )
              onChange({
                ...config,
                numChoices: labels.length,
                labels,
                correctAnswers: config.correctAnswers.filter(
                  (i) => i < labels.length
                ),
              })
            }
          }}
        >
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHOICE_LABEL_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* カスタムラベル入力 */}
      {isCustom && (
        <div className="flex items-center gap-1.5">
          <Label className="min-w-12 text-xs text-muted-foreground">入力</Label>
          <Input
            className="h-7 w-44 text-xs"
            value={customInput}
            placeholder="例: +,-,±"
            onChange={(e) => {
              const value = e.target.value
              setCustomInput(value)
              const labels = value
                .split(",")
                .map((label) => label.trim())
                .filter((label) => label.length > 0)
              if (labels.length >= 2) {
                onChange({
                  ...config,
                  numChoices: labels.length,
                  labels,
                  correctAnswers: config.correctAnswers.filter(
                    (i) => i < labels.length
                  ),
                })
              }
            }}
          />
        </div>
      )}

      {/* 選択肢数（プリセット時のみ調整可能） */}
      {!isCustom && (
        <div className="flex items-center gap-1.5">
          <Label className="min-w-12 text-xs text-muted-foreground">
            選択肢数
          </Label>
          <input
            type="number"
            className="h-7 w-14 [appearance:textfield] rounded border border-input px-1.5 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={config.numChoices}
            min={2}
            max={10}
            onChange={(e) => {
              const n = Math.max(2, Math.min(10, Number(e.target.value) || 4))
              const preset = CHOICE_LABEL_PRESETS.find(
                (p) => p.value === currentPresetValue
              )
              const labels = (
                preset?.labels ?? CHOICE_LABEL_PRESETS[0].labels
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
      )}

      {/* 配置方向 */}
      <div className="flex items-center gap-1.5">
        <Label className="min-w-12 text-xs text-muted-foreground">配置</Label>
        <Select
          value={config.layout}
          onValueChange={(v: "horizontal" | "vertical") =>
            onChange({ ...config, layout: v })
          }
        >
          <SelectTrigger className="h-7 w-44 text-xs">
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
        <Label className="mt-1 min-w-12 text-xs text-muted-foreground">
          正解
        </Label>
        <div className="flex flex-wrap gap-1">
          {config.labels.map((label, idx) => {
            const isSelected = config.correctAnswers.includes(idx)
            return (
              <button
                key={idx}
                type="button"
                className={`h-6 min-w-6 rounded border px-1 text-xs ${
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
