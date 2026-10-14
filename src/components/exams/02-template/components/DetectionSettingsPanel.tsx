/**
 * 検出設定パネルコンポーネント
 */

"use client"

import { memo, useCallback } from "react"

import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"

import type { DetectionSettings } from "../types"

interface DetectionSettingsPanelProps {
  settings: DetectionSettings
  onSettingsChange: (partial: Partial<DetectionSettings>) => void
  onReset?: () => void
  /** 検出中か（見出しの行に「検出中...」を出す） */
  isDetecting: boolean
  /** 検出された枠の数 */
  detectedCount: number
}

export const DetectionSettingsPanel = memo(function DetectionSettingsPanel({
  settings,
  onSettingsChange,
  onReset,
  isDetecting,
  detectedCount,
}: DetectionSettingsPanelProps) {
  const handleChange = useCallback(
    (key: keyof DetectionSettings, value: number) => {
      onSettingsChange({ [key]: value })
    },
    [onSettingsChange]
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">検出設定</h3>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {isDetecting ? (
            <>
              <Spinner className="size-3" />
              検出中...
            </>
          ) : (
            `検出枠: ${detectedCount}個`
          )}
        </span>
      </div>

      {/* 罫線の最短の長さ */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>罫線の最短の長さ</span>
          <span className="font-mono">{settings.minLineLengthMm}mm</span>
        </label>
        <Slider
          min={1}
          max={30}
          step={1}
          value={[settings.minLineLengthMm]}
          onValueChange={([nextMinLineLengthMm]) =>
            handleChange("minLineLengthMm", nextMinLineLengthMm)
          }
          title="この長さ（用紙上の mm）以上の黒い線を罫線とみなす"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
          <span>短い線も拾う</span>
          <span>長い線だけ</span>
        </div>
      </div>

      {/* 仕切り線の長さ */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>仕切り線の長さ</span>
          <span className="font-mono">
            {Math.round(settings.minDividerLength * 100)}%
          </span>
        </label>
        <Slider
          min={0.5}
          max={1}
          step={0.05}
          value={[settings.minDividerLength]}
          onValueChange={([nextMinDividerLength]) =>
            handleChange("minDividerLength", nextMinDividerLength)
          }
          title="枠の幅（高さ）に対してこの割合以上の長さがある線は、壁に届いていなくても仕切りとみなして枠を割る。100%なら壁から壁まで届く線だけ"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
          <span>途切れた線も仕切りに</span>
          <span>届く線だけ</span>
        </div>
      </div>

      {/* 最小幅 */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>最小幅</span>
          <span className="font-mono">{settings.minWidthMm}mm</span>
        </label>
        <Slider
          min={1}
          max={30}
          step={1}
          value={[settings.minWidthMm]}
          onValueChange={([nextMinWidthMm]) =>
            handleChange("minWidthMm", nextMinWidthMm)
          }
          title="これより幅の狭い枠は出さない（用紙上の mm）。縦の仕切り線で割るとこれより狭い枠ができるときは割らない"
        />
      </div>

      {/* 最小高さ */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>最小高さ</span>
          <span className="font-mono">{settings.minHeightMm}mm</span>
        </label>
        <Slider
          min={1}
          max={30}
          step={1}
          value={[settings.minHeightMm]}
          onValueChange={([nextMinHeightMm]) =>
            handleChange("minHeightMm", nextMinHeightMm)
          }
          title="これより高さの低い枠は出さない（用紙上の mm）。横の仕切り線で割るとこれより低い枠ができるときは割らない"
        />
      </div>

      {onReset && (
        <button
          type="button"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          onClick={onReset}
        >
          デフォルトに戻す
        </button>
      )}
    </section>
  )
})
