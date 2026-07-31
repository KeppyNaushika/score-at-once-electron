"use client"

import { FileUp, Loader2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"

interface FileSelectStepProps {
  wizard: StudentImportWizard
}

export function FileSelectStep({ wizard }: FileSelectStepProps) {
  const { state, selectFile } = wizard

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Users className="h-10 w-10 text-primary" />
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold">
          生徒データファイルを選択してください
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          .studentsファイルを選択して、生徒・学級データをインポートします
        </p>
      </div>

      <Button
        size="lg"
        onClick={selectFile}
        disabled={state.isProcessing}
        className="gap-2"
      >
        {state.isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            読み込み中...
          </>
        ) : (
          <>
            <FileUp className="h-5 w-5" />
            ファイルを選択
          </>
        )}
      </Button>

      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-center text-xs text-muted-foreground">
          対応形式: .students（生徒データアーカイブ）
        </p>
      </div>
    </div>
  )
}
