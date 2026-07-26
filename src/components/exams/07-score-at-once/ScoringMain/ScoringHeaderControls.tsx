"use client"

import { Gavel, PanelRightClose, PanelRightOpen, ScanLine } from "lucide-react"

import GradingModeToggle from "@/components/exams/07-score-at-once/ScoringMain/GradingModeToggle"
import { KeyboardHelpDialog } from "@/components/exams/07-score-at-once/ScoringMain/KeyboardHelpDialog"
import type { GradingMode } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"

interface ScoringHeaderControlsProps {
  gradingMode: GradingMode
  onGradingModeChange: (mode: GradingMode) => void
  showKeyboardHelp: boolean
  onShowKeyboardHelpChange: (show: boolean) => void
  showSidePanel: boolean
  onShowSidePanelChange: (show: boolean) => void
  modifierKeyLabel: string
  helpButton: React.ReactNode
  onOmrRecognitionClick?: () => void
  /** 確定パネルを開く。単独採点（裁定対象なし）では undefined でボタンを出さない */
  onScoreDecisionClick?: () => void
  /** 裁定が必要なセル数（0なら件数バッジを出さない） */
  pendingDecisionCount?: number
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
  onOmrRecognitionClick,
  onScoreDecisionClick,
  pendingDecisionCount = 0,
}: ScoringHeaderControlsProps) {
  return (
    <div className="flex items-center space-x-2">
      {/* 採点モード切り替え */}
      <GradingModeToggle
        mode={gradingMode}
        onModeChange={onGradingModeChange}
      />

      {/* OMR認識 */}
      {onOmrRecognitionClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOmrRecognitionClick}
          title="OMR自動採点"
        >
          <ScanLine className="mr-1 h-4 w-4" />
          OMR認識
        </Button>
      )}

      {/* 採点結果の確定（協調採点で裁定対象が出たときだけ現れる） */}
      {onScoreDecisionClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onScoreDecisionClick}
          title="採点結果の確定"
        >
          <Gavel className="mr-1 h-4 w-4" />
          確定
          {pendingDecisionCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {pendingDecisionCount}
            </span>
          )}
        </Button>
      )}

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
