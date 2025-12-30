"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"
import { KEYBOARD_SHORTCUTS } from "@/components/projects/07-score-at-once/ScoringMain/constants/keyboardShortcuts"

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
  return (
    <Dialog open={showKeyboardHelp} onOpenChange={onShowKeyboardHelpChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Keyboard className="mr-2 h-4 w-4" />
          キーボード
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>キーボードショートカット</DialogTitle>
          <DialogDescription>
            効率的な採点のためのキーボードショートカット一覧
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="mb-3 font-medium">採点操作</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(KEYBOARD_SHORTCUTS.SCORING).map(
                ([key, shortcut]) => (
                  <div key={key} className="flex justify-between">
                    <span>{shortcut.label}</span>
                    <code className="rounded bg-gray-100 px-2 py-1">
                      {shortcut.key}
                    </code>
                  </div>
                )
              )}
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-medium">ナビゲーション</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(KEYBOARD_SHORTCUTS.NAVIGATION).map(
                ([key, shortcut]) => (
                  <div key={key} className="flex justify-between">
                    <span>{shortcut.label}</span>
                    <code className="rounded bg-gray-100 px-2 py-1">
                      {shortcut.key === "採点キー"
                        ? `${modifierKeyLabel}+採点キー`
                        : shortcut.key}
                    </code>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
