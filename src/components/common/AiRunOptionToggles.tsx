"use client"

import { type ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { GradingEffort } from "@/electron-src/lib/aiGrading/providers/types"
import { ignoreDeselect } from "@/lib/toggleSelection"
import {
  AI_GRADING_RUN_MODES,
  type AiGradingRunMode,
} from "@/types/aiGrading.types"

/** 選べる Effort（main の `GRADING_EFFORTS` と同じ並び。renderer は main を値で引けない） */
const EFFORT_OPTIONS = [
  "low",
  "medium",
  "high",
] as const satisfies readonly GradingEffort[]

const EFFORT_LABELS: Record<GradingEffort, string> = {
  low: "低",
  medium: "中",
  high: "高",
}

const RUN_MODE_LABELS: Record<AiGradingRunMode, string> = {
  realtime: "すぐに",
  batch: "バッチ",
}

interface ToggleColumnProps {
  id: string
  label: string
  children: ReactNode
}

/** 1列ぶん（上に見出し、下に切り替えボタン）。ボタンは列の幅いっぱいに広げる */
function ToggleColumn({ id, label, children }: ToggleColumnProps) {
  return (
    <div className="min-w-0 space-y-1">
      <Label id={`${id}-label`}>{label}</Label>
      {children}
    </div>
  )
}

/** 処理（すぐに / バッチ。改訂のダイアログは1往復なので出さない） */
interface SendingOptions {
  mode: AiGradingRunMode
  onModeChange: (mode: AiGradingRunMode) => void
  /** 事業者がバッチで送れるか（送れなければバッチを選ばせない） */
  isBatchAvailable: boolean
}

interface AiRunOptionTogglesProps {
  /** 各切り替えの id の接頭辞（`${idPrefix}-effort` 等） */
  idPrefix: string
  effort: GradingEffort
  onEffortChange: (effort: GradingEffort) => void
  /** 選んだモデルが Effort を受け付けないとき（選ばせない） */
  isEffortDisabled: boolean
  /** 処理も選ばせるときだけ渡す */
  sendingOptions: SendingOptions | null
}

/**
 * AI 採点の実行の、少数で固定の選択肢（Effort・処理）を、横並びの切り替えボタンで
 * 1行に並べる。設定画面の既定値と、07 の実行のダイアログが使う。
 *
 * 画像の拡大率は選ばせない（常に原寸で送る）。拡大しても画像の情報は増えず、縮小は
 * 読み取りへの影響を目で確かめてから入れる
 *
 * 単一選択の ToggleGroup（Radix）なので、Tab で入り、←→ で移り、Space / Enter で選べる。
 * 選んでいるものをもう一度押しても外れない（どれかが必ず選ばれている）。
 */
export function AiRunOptionToggles({
  idPrefix,
  effort,
  onEffortChange,
  isEffortDisabled,
  sendingOptions,
}: AiRunOptionTogglesProps) {
  const effortId = `${idPrefix}-effort`
  const modeId = `${idPrefix}-mode`
  const notes = [
    isEffortDisabled
      ? "このモデルは Effort を受け付けません（モデルの既定の深さで考えます）"
      : null,
    sendingOptions && !sendingOptions.isBatchAvailable
      ? "この事業者はバッチで送れません"
      : null,
  ].filter((note) => note !== null)

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-3">
        <ToggleColumn id={effortId} label="Effort">
          <ToggleGroup
            id={effortId}
            type="single"
            variant="outline"
            size="sm"
            value={effort}
            aria-labelledby={`${effortId}-label`}
            disabled={isEffortDisabled}
            onValueChange={ignoreDeselect(EFFORT_OPTIONS, onEffortChange)}
            className="w-full"
          >
            {EFFORT_OPTIONS.map((effortOption) => (
              <ToggleGroupItem key={effortOption} value={effortOption}>
                {EFFORT_LABELS[effortOption]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ToggleColumn>

        {sendingOptions && (
          <ToggleColumn id={modeId} label="処理">
            <ToggleGroup
              id={modeId}
              type="single"
              variant="outline"
              size="sm"
              value={sendingOptions.mode}
              aria-labelledby={`${modeId}-label`}
              onValueChange={ignoreDeselect(
                AI_GRADING_RUN_MODES,
                sendingOptions.onModeChange
              )}
              className="w-full"
            >
              {AI_GRADING_RUN_MODES.map((mode) => (
                <ToggleGroupItem
                  key={mode}
                  value={mode}
                  disabled={
                    mode === "batch" && !sendingOptions.isBatchAvailable
                  }
                >
                  {RUN_MODE_LABELS[mode]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ToggleColumn>
        )}
      </div>
      {notes.map((note) => (
        <p key={note} className="text-xs text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  )
}
