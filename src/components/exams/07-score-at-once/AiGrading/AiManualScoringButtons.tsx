"use client"

import { Calculator } from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { KeyboardScoringButtons } from "@/components/exams/07-score-at-once/ScoringSidePanel/KeyboardScoringButtons"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface AiManualScoringButtonsProps {
  /** 1件ずつ自分で採点している最中か（焦点の答案があるときだけ押せる） */
  isEnabled: boolean
  /** 焦点の答案に点を付ける（採点キーと同じ。下書き） */
  onScore: (status: ScoringStatus) => void
  /** 部分点の入力欄を開く（数字キーと同じ） */
  onOpenPartialScore: () => void
}

/** ボタンを押したあと、Enter などのキーがボタンに吸われないよう焦点を外す */
function releaseButtonFocus() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

/**
 * 問いかけの「1件ずつ自分で採点する」の採点ボタン（docs/vlm-grading-design.md §3-5）。
 * 採点キーと同じく焦点の答案に**下書き**の点を付け、見直しの「確定する」で入る
 */
export function AiManualScoringButtons({
  isEnabled,
  onScore,
  onOpenPartialScore,
}: AiManualScoringButtonsProps) {
  const { keyBindings } = useKeyBindings()
  const partialOpenKeys = `${formatKeyForDisplay(keyBindings["scoring.openPartialWith0"])}〜${formatKeyForDisplay(keyBindings["scoring.openPartialWith9"])}`
  return (
    <section aria-label="自分で採点" className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-gray-800">自分で採点</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            onOpenPartialScore()
            releaseButtonFocus()
          }}
          disabled={!isEnabled}
        >
          <Calculator className="h-3.5 w-3.5" />
          部分点入力
          <Kbd variant="tiny">{partialOpenKeys}</Kbd>
        </Button>
      </div>
      <KeyboardScoringButtons
        selectedAnswersCount={isEnabled ? 1 : 0}
        onScore={(status) => {
          onScore(status)
          releaseButtonFocus()
        }}
      />
      {!isEnabled && (
        <p className="text-[10px] text-muted-foreground">
          「1件ずつ自分で採点する」で使えます
        </p>
      )}
    </section>
  )
}
