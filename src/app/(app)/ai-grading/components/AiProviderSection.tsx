"use client"

import { useMutation } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { ProviderStatus } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import {
  AI_GRADING_CONSENT_ITEMS,
  AI_GRADING_PROVIDER_TERMS,
  AI_GRADING_REVOCATION_ITEM,
} from "@/lib/shared/aiGrading/consentText"
import { revokeAiProviderConsentMutation } from "@/queries/aiProvider"

import { AiGradingConsentDialog } from "./AiGradingConsentDialog"
import { AiProviderApiKeyForm } from "./AiProviderApiKeyForm"
import { AiProviderConnectionTest } from "./AiProviderConnectionTest"

interface AiProviderSectionProps {
  status: ProviderStatus
  /** 今の利用者が、今の版の同意文に同意しているか */
  isConsentCurrent: boolean
}

/**
 * 事業者1つ分。同意するまでは説明と同意の入口だけを出し、キーの入力欄も出さない。
 */
export function AiProviderSection({
  status,
  isConsentCurrent,
}: AiProviderSectionProps) {
  const providerName = AI_GRADING_PROVIDER_TERMS[status.provider].providerName
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false)
  const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false)
  const revokeConsent = useMutation(revokeAiProviderConsentMutation())

  const handleRevoke = () => {
    revokeConsent.mutate(status.provider, {
      onSuccess: () =>
        toast.success(
          `${providerName} への同意を取り消し、この端末の API キーを削除しました`
        ),
    })
  }

  return (
    <section
      aria-label={`送信先: ${providerName}`}
      className="space-y-4 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          送信先: {providerName}
          {isConsentCurrent && <ExperimentalBadge />}
        </h3>
        {isConsentCurrent && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            同意済み
          </span>
        )}
      </div>

      {isConsentCurrent ? (
        <>
          <AiProviderApiKeyForm status={status} />
          <AiProviderConnectionTest
            provider={status.provider}
            hasApiKey={status.hasApiKey}
          />
          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setIsRevokeConfirmOpen(true)}
            >
              同意を取り消す
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {status.consent !== null && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              同意文が改められたか、別の利用者の同意が記録されています。この利用者で使うには、改めて同意してください。
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {providerName}{" "}
            へ答案の切り出し画像などを送り、採点の候補を受け取ります。使うには、送られるもの・送り先・責任の所在などを
            {AI_GRADING_CONSENT_ITEMS.length}
            項目に分けて確かめ、同意してください。同意するまで API
            キーの入力欄は表示しません。
          </p>
          <Button type="button" onClick={() => setIsConsentDialogOpen(true)}>
            同意の手順へ進む
          </Button>
        </div>
      )}

      {/* 閉じている間はマウントしない。開くたびに確かめた印を作り直す */}
      {isConsentDialogOpen && (
        <AiGradingConsentDialog
          provider={status.provider}
          onClose={() => setIsConsentDialogOpen(false)}
        />
      )}

      <AlertDialog
        open={isRevokeConfirmOpen}
        onOpenChange={setIsRevokeConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {providerName} への同意を取り消しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {AI_GRADING_REVOCATION_ITEM.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>
              同意を取り消す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
