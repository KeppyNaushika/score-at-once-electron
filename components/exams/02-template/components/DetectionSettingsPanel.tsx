/**
 * 検出設定パネルコンポーネント（シンプル版）
 */

"use client"

import { memo, useCallback } from "react"

import { DetectionSettings } from "../types"

interface DetectionSettingsPanelProps {
  settings: DetectionSettings
  onSettingsChange: (partial: Partial<DetectionSettings>) => void
  onReset?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export const DetectionSettingsPanel = memo(function DetectionSettingsPanel({
  settings,
  onSettingsChange,
  onReset,
  collapsed = true,
  onToggleCollapse,
}: DetectionSettingsPanelProps) {
  const handleChange = useCallback(
    (key: keyof DetectionSettings, value: number) => {
      onSettingsChange({ [key]: value })
    },
    [onSettingsChange]
  )

  return (
    <div className="rounded border border-gray-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
        onClick={onToggleCollapse}
      >
        <span>検出設定</span>
        <svg
          className={`h-4 w-4 transform transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {!collapsed && (
        <div className="space-y-3 border-t border-gray-200 px-3 py-2">
          {/* 線の延長 */}
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>線の延長</span>
              <span className="font-mono">{settings.lineExtension}px</span>
            </label>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={settings.lineExtension}
              onChange={(e) =>
                handleChange("lineExtension", parseInt(e.target.value))
              }
              title="線の延長"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
            />
          </div>

          {/* 最小幅 */}
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>最小幅</span>
              <span className="font-mono">
                {Math.round(settings.minWidth * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={0.01}
              max={0.3}
              step={0.01}
              value={settings.minWidth}
              onChange={(e) =>
                handleChange("minWidth", parseFloat(e.target.value))
              }
              title="最小幅"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
            />
          </div>

          {/* 最小高さ */}
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>最小高さ</span>
              <span className="font-mono">
                {Math.round(settings.minHeight * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={0.01}
              max={0.3}
              step={0.01}
              value={settings.minHeight}
              onChange={(e) =>
                handleChange("minHeight", parseFloat(e.target.value))
              }
              title="最小高さ"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
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
        </div>
      )}
    </div>
  )
})
