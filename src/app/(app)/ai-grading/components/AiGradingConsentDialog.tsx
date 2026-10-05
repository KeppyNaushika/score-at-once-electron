"use client"

import { useMutation } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
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
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import {
  AI_GRADING_CONSENT_ITEMS,
  AI_GRADING_PROVIDER_TERMS,
} from "@/lib/shared/aiGrading/consentText"
import {
  openAiProviderTermsLinkMutation,
  recordAiProviderConsentMutation,
} from "@/queries/aiProvider"

interface AiGradingConsentDialogProps {
  provider: GradingProviderId
  onClose: () => void
}

/**
 * 事業者ごとの同意（設計 §9-1）。8項目を1つずつ確かめないと「同意して有効にする」を押せない。
 *
 * 開くたびにマウントし直す前提（確かめた印を持ち越さない）。
 */
export function AiGradingConsentDialog({
  provider,
  onClose,
}: AiGradingConsentDialogProps) {
  const providerTerms = AI_GRADING_PROVIDER_TERMS[provider]
  const [checkedItemKeys, setCheckedItemKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const recordConsent = useMutation(recordAiProviderConsentMutation())
  const openTermsLink = useMutation(openAiProviderTermsLinkMutation())

  const allChecked = AI_GRADING_CONSENT_ITEMS.every((consentItem) =>
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
    recordConsent.mutate(provider, {
      onSuccess: () => {
        toast.success(
          `${providerTerms.providerName} への送信を伴う AI 採点（実験的機能）を有効にしました`
        )
        onClose()
      },
    })
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
            AI採点への同意（送信先: {providerTerms.providerName}）
            <ExperimentalBadge />
          </DialogTitle>
          <DialogDescription>
            以下の{AI_GRADING_CONSENT_ITEMS.length}
            項目をお読みいただき、それぞれ確認のうえチェックしてください。すべての項目を確認すると、この機能を有効にできます。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <ol className="space-y-3">
            {AI_GRADING_CONSENT_ITEMS.map((consentItem, index) => {
              const checkboxId = `ai-consent-${provider}-${consentItem.key}`
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

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="mb-2 font-medium">
              参考：{providerTerms.providerName}{" "}
              の規約（既定のブラウザで開きます）
            </p>
            <ul className="space-y-1">
              {providerTerms.links.map((termsLink) => (
                <li key={termsLink.key}>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() =>
                      openTermsLink.mutate({
                        provider,
                        linkKey: termsLink.key,
                      })
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {termsLink.label}
                  </Button>
                  <span className="ml-2 font-mono text-xs break-all text-muted-foreground">
                    {termsLink.url}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            確認済み: {checkedItemKeys.size} / {AI_GRADING_CONSENT_ITEMS.length}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              type="button"
              disabled={!allChecked || recordConsent.isPending}
              onClick={handleConsent}
            >
              同意して有効にする
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
