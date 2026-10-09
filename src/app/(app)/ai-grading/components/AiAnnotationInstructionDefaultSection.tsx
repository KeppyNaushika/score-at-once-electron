"use client"

import { useMutation } from "@tanstack/react-query"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { updateAiGradingSettingsMutation } from "@/queries/aiProvider"

interface AiAnnotationInstructionDefaultSectionProps {
  settings: AiGradingSettings
}

/**
 * 新しく作るプロンプトの「助言の文案の指示」に最初から入れる文言（設計 §3-1）。
 *
 * 入力欄から離れたときに保存する（同じタブの他の入力欄と同じ）。複数行なので Enter は改行のまま。
 * 既存のプロンプトは変わらず、元の版を写して作る版も元の版の値を引き継ぐ
 */
export function AiAnnotationInstructionDefaultSection({
  settings,
}: AiAnnotationInstructionDefaultSectionProps) {
  const updateSettings = useMutation(updateAiGradingSettingsMutation())

  const saveInstruction = (instruction: string) => {
    if (instruction === settings.defaultAnnotationInstruction) return
    updateSettings.mutate({ defaultAnnotationInstruction: instruction })
  }

  return (
    <section
      aria-label="助言の文案の指示の既定の文言"
      className="space-y-2 rounded-lg border p-4"
    >
      <h3 className="text-base font-semibold">
        <Label htmlFor="ai-default-annotation-instruction">
          助言の文案の指示の既定の文言
        </Label>
      </h3>
      <p className="text-xs text-muted-foreground">
        07
        でプロンプトを新規追加するとき、「助言の文案の指示」の欄に最初から入れておく文言です。作ったプロンプトの中で書き換えられます。すでにあるプロンプトは変わりません。空欄なら、欄は空欄から始まります。
      </p>
      <Textarea
        key={settings.defaultAnnotationInstruction}
        id="ai-default-annotation-instruction"
        defaultValue={settings.defaultAnnotationInstruction}
        onBlur={(event) => saveInstruction(event.target.value)}
        rows={4}
        placeholder="例: 20字以内で、何を直せばよいかを書く。「です・ます」で"
        className="max-w-2xl"
      />
    </section>
  )
}
