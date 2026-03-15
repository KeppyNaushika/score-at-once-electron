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
      <div className="bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full">
        <Users className="text-primary h-10 w-10" />
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold">
          生徒データファイルを選択してください
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
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

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-muted-foreground text-center text-xs">
          対応形式: .students（生徒データアーカイブ）
        </p>
      </div>
    </div>
  )
}
