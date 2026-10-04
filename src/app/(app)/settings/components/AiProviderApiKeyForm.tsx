"use client"

import { useMutation } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ProviderStatus } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"
import {
  clearAiProviderApiKeyMutation,
  setAiProviderApiKeyMutation,
} from "@/queries/aiProvider"

interface AiProviderApiKeyFormProps {
  status: ProviderStatus
}

/**
 * API キーの入力。**保存したキーは画面に出さない**（main にもキーを返す口は無い）。
 * 保存後は「設定済み」と「削除」だけを示す。
 */
export function AiProviderApiKeyForm({ status }: AiProviderApiKeyFormProps) {
  const providerName = AI_GRADING_PROVIDER_TERMS[status.provider].providerName
  const inputId = `ai-api-key-${status.provider}`
  const [apiKeyDraft, setApiKeyDraft] = useState("")
  const setApiKey = useMutation(setAiProviderApiKeyMutation())
  const clearApiKey = useMutation(clearAiProviderApiKeyMutation())

  if (!status.isEncryptionAvailable) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        この環境では API
        キーを暗号化して保存できないため、キーを保存できません。
      </p>
    )
  }

  if (status.hasApiKey) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label>API キー</Label>
          <p className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            設定済み
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={clearApiKey.isPending}
          onClick={() =>
            clearApiKey.mutate(status.provider, {
              onSuccess: () =>
                toast.success(`${providerName} の API キーを削除しました`),
            })
          }
        >
          削除
        </Button>
      </div>
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const apiKey = apiKeyDraft.trim()
    if (apiKey === "") return
    setApiKey.mutate(
      { provider: status.provider, apiKey },
      {
        onSuccess: () => {
          // 入力欄にもキーを残さない
          setApiKeyDraft("")
          toast.success(`${providerName} の API キーを保存しました`)
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor={inputId}>API キー</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKeyDraft}
          onChange={(event) => setApiKeyDraft(event.target.value)}
          placeholder={`${providerName} の API キー`}
          className="font-mono"
        />
        <Button
          type="submit"
          disabled={apiKeyDraft.trim() === "" || setApiKey.isPending}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          保存
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        キーはこの端末だけに暗号化して保存し、保存後は表示しません。キーは利用者が自分で事業者と契約して用意します。
      </p>
    </form>
  )
}
