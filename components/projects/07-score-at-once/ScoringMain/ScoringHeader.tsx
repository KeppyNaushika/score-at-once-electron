"use client"

import { ChevronLeft, PanelRightClose, PanelRightOpen } from "lucide-react"

import GradingModeToggle from "@/components/projects/07-score-at-once/ScoringMain/GradingModeToggle"
import ScoringKeyboardHelp from "@/components/projects/07-score-at-once/ScoringMain/ScoringKeyboardHelp"
import type { GradingMode } from "@/components/projects/07-score-at-once/types"
import { Button } from "@/components/ui/button"

interface ScoringProject {
  examName: string
}

interface ScoringQuestion {
  label: string | null
  orderIndex: number | null
}

interface ScoringHeaderProps {
  project: ScoringProject | null
  currentQuestion: ScoringQuestion | null
  gradingMode: GradingMode
  showKeyboardHelp: boolean
  showSidePanel: boolean
  modifierKeyLabel: string
  onModeChange: (mode: GradingMode) => void
  onKeyboardHelpChange: (show: boolean) => void
  onSidePanelToggle: () => void
  onBackToProject: () => void
}

export default function ScoringHeader({
  project,
  currentQuestion,
  gradingMode,
  showKeyboardHelp,
  showSidePanel,
  modifierKeyLabel,
  onModeChange,
  onKeyboardHelpChange,
  onSidePanelToggle,
  onBackToProject,
}: ScoringHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        {/* 左側: プロジェクト情報 */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToProject}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{project?.examName}</h1>
            {currentQuestion && (
              <p className="text-sm text-gray-600">
                {currentQuestion.label} (
                {currentQuestion.label || currentQuestion.orderIndex || 1}番)
              </p>
            )}
          </div>
        </div>

        {/* 右側: 操作ボタン */}
        <div className="flex items-center space-x-2">
          {/* 採点モード切り替え */}
          <GradingModeToggle
            mode={gradingMode}
            onModeChange={onModeChange}
            className="mr-4"
          />

          {/* キーボードヘルプ */}
          <ScoringKeyboardHelp
            isOpen={showKeyboardHelp}
            onOpenChange={onKeyboardHelpChange}
            modifierKeyLabel={modifierKeyLabel}
          />

          {/* サイドパネル表示切り替え */}
          <Button
            variant="outline"
            size="sm"
            onClick={onSidePanelToggle}
            className="flex items-center space-x-2"
          >
            {showSidePanel ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
            <span>{showSidePanel ? "非表示" : "表示"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
