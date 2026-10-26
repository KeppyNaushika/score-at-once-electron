"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { BetaBadge } from "@/components/common/BetaBadge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SYNC_CONSENT_ITEMS } from "@/lib/shared/syncConsentText"
import { recordSyncConsentMutation } from "@/queries/sync"

interface SyncConsentDialogProps {
  /**
   * どこで求めているか。
   *
   * - `before-start`: 共有モードへ入る前（同期設定の画面）。同意しなければ入れない
   * - `while-running`: 共有モードで動いているのに、今の版に同意していない。閉じても同期は続く
   */
  situation: "before-start" | "while-running"
  onConsented: () => void
  onClose: () => void
}

/**
 * 共有モードの同意。項目を1つずつ確かめないと「同意する」を押せない
 * （`AiGradingConsentDialog` と同じ形）。
 *
 * 開くたびにマウントし直す前提（確かめた印を持ち越さない）。
 */
export function SyncConsentDialog({
  situation,
  onConsented,
  onClose,
}: SyncConsentDialogProps) {
  const [checkedItemKeys, setCheckedItemKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const recordConsent = useMutation(recordSyncConsentMutation())

  const allChecked = SYNC_CONSENT_ITEMS.every((consentItem) =>
    checkedItemKeys.has(consentItem.key)
  )

  const toggleItem = (itemKey: string, checked: boolean) => {
    setCheckedItemKeys((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(itemKey)
      } else {
        next.delete(itemKey)
      }
      return next
    })
  }

  const handleConsent = () => {
    if (!allChecked) return
    recordConsent.mutate(undefined, { onSuccess: onConsented })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            共有モードの注意事項への同意
            <BetaBadge />
          </DialogTitle>
          <DialogDescription>
            {situation === "while-running"
              ? "このPCは共有モードで動いていますが、今の注意事項にまだ同意していません。閉じても同期は続きます。同意するまで、起動するたびにこの画面を出します。"
              : "共有モードを使う前に、以下の項目をお読みいただき、それぞれ確認のうえチェックしてください。"}
            共有モードの注意事項への同意は、PCごとに必要です。同じ共有フォルダを使用する他のPCでも、それぞれ同意してください。
          </DialogDescription>
        </DialogHeader>

        <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {SYNC_CONSENT_ITEMS.map((consentItem, index) => {
            const checkboxId = `sync-consent-${consentItem.key}`
            return (
              <li
                key={consentItem.key}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <Checkbox
                  id={checkboxId}
                  className="mt-1"
                  checked={checkedItemKeys.has(consentItem.key)}
                  onCheckedChange={(checked) =>
                    toggleItem(consentItem.key, checked === true)
                  }
                />
                <label htmlFor={checkboxId} className="space-y-1 text-sm">
                  <span className="block font-medium">
                    {index + 1}. {consentItem.title}
                  </span>
                  <span className="block text-muted-foreground">
                    {consentItem.body}
                  </span>
                </label>
              </li>
            )
          })}
        </ol>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            確認済み: {checkedItemKeys.size} / {SYNC_CONSENT_ITEMS.length}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {situation === "while-running" ? "あとで" : "キャンセル"}
            </Button>
            <Button
              type="button"
              disabled={!allChecked || recordConsent.isPending}
              onClick={handleConsent}
            >
              同意する
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
