"use client"

import { Keyboard } from "lucide-react"

import {
  formatKeyForDisplay,
  getShortcutLabel,
} from "@/components/exams/07-score-at-once/constants/shortcutCatalog"
import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { KEYBOARD_HELP_SECTIONS } from "@/components/exams/07-score-at-once/ScoringMain/constants/keyboardShortcuts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface KeyboardHelpDialogProps {
  showKeyboardHelp: boolean
  onShowKeyboardHelpChange: (show: boolean) => void
  modifierKeyLabel: string
}

export function KeyboardHelpDialog({
  showKeyboardHelp,
  onShowKeyboardHelpChange,
  modifierKeyLabel,
}: KeyboardHelpDialogProps) {
  // 一覧は実際に効く割り当て（利用者の設定を反映したもの）から作る
  const { keyBindings } = useKeyBindings()
  const displayKey = (commandId: string) =>
    formatKeyForDisplay(keyBindings[commandId], modifierKeyLabel)

  return (
    <Dialog open={showKeyboardHelp} onOpenChange={onShowKeyboardHelpChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Keyboard className="mr-2 h-4 w-4" />
          キーボード
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>キーボードショートカット</DialogTitle>
          <DialogDescription>
            いま使えるキーの一覧です。キーは設定画面の「キーボード」で変えられます
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] grid-cols-2 gap-6 overflow-y-auto pr-2">
          {KEYBOARD_HELP_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="mb-3 font-medium">{section.title}</h4>
              <div className="space-y-2 text-sm">
                {section.commandIds.map((commandId) => (
                  <div key={commandId} className="flex justify-between gap-2">
                    <span>{getShortcutLabel(commandId)}</span>
                    <code className="rounded bg-gray-100 px-2 py-1">
                      {displayKey(commandId)}
                    </code>
                  </div>
                ))}
                {section.showPartialScoreStart && (
                  <div className="flex justify-between gap-2">
                    <span>部分点の入力を始める</span>
                    <code className="rounded bg-gray-100 px-2 py-1">
                      {displayKey("scoring.openPartialWith0")}〜
                      {displayKey("scoring.openPartialWith9")}・
                      {displayKey("scoring.openPartialWithDot")}
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
