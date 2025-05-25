"use client"

import React from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function TemplateStepPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.examId as string

  const goToNextStep = () => {
    // router.push(`/exams/${examId}/score/upload`);
    alert("次のステップ（解答用紙アップロード）へ進みます。")
  }
  const goToPreviousStep = () => {
    router.push(`/exams/${examId}/score`)
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">
        ステップ2: 採点テンプレートの作成
      </h2>
      <p>ここに採点テンプレート作成のUIが入ります。(examId: {examId})</p>
      {/* Template creation UI */}
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={goToPreviousStep}>
          前へ: 模範解答設定
        </Button>
        <Button onClick={goToNextStep}>次へ: 解答用紙アップロード</Button>
      </div>
    </div>
  )
}
