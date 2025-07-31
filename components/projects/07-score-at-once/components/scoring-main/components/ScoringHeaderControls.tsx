"use client"

import GradingModeToggle, { GradingMode } from "@/components/projects/07-score-at-once/components/GradingModeToggle"
import { Button } from "@/components/ui/button"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { KeyboardHelpDialog } from "@/components/projects/07-score-at-once/components/scoring-main/components/KeyboardHelpDialog"

interface ScoringHeaderControlsProps {
  gradingMode: GradingMode
  onGradingModeChange: (mode: GradingMode) => void
  showKeyboardHelp: boolean
  onShowKeyboardHelpChange: (show: boolean) => void
  showSidePanel: boolean
  onShowSidePanelChange: (show: boolean) => void
  modifierKeyLabel: string
  helpButton: React.ReactNode
}

export function ScoringHeaderControls({
  gradingMode,
  onGradingModeChange,
  showKeyboardHelp,
  onShowKeyboardHelpChange,
  showSidePanel,
  onShowSidePanelChange,
  modifierKeyLabel,
  helpButton,
}: ScoringHeaderControlsProps) {
  return (
    <div className="flex items-center space-x-2">
      {/* 採点モード切り替え */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">採点モード:</span>
        <GradingModeToggle mode={gradingMode} onModeChange={onGradingModeChange} />
      </div>

      {/* キーボードヘルプ */}
      <KeyboardHelpDialog
        showKeyboardHelp={showKeyboardHelp}
        onShowKeyboardHelpChange={onShowKeyboardHelpChange}
        modifierKeyLabel={modifierKeyLabel}
      />

      {/* サイドパネル表示切り替え */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onShowSidePanelChange(!showSidePanel)}
      >
        {showSidePanel ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <PanelRightOpen className="h-4 w-4" />
        )}
      </Button>

      {helpButton}
    </div>
  )
}