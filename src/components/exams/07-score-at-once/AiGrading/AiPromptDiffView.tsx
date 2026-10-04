"use client"

import type { AiPromptRow } from "./types"
import { diffPromptLines, hasPromptChanges } from "./utils/promptDiff"

/** 差分を見せる欄（並び＝画面の並び） */
const PROMPT_DIFF_FIELDS = [
  { field: "questionText", label: "問題文" },
  { field: "modelAnswerText", label: "模範解答" },
  { field: "rubricText", label: "採点基準" },
] as const

interface AiPromptDiffViewProps {
  parentPrompt: AiPromptRow
  revisedPrompt: AiPromptRow
}

/** 改訂したプロンプトを、元のプロンプトとの行単位の差分で見せる（設計 §3-1） */
export function AiPromptDiffView({
  parentPrompt,
  revisedPrompt,
}: AiPromptDiffViewProps) {
  return (
    <div className="space-y-3" aria-label="プロンプトの差分">
      {PROMPT_DIFF_FIELDS.map(({ field, label }) => {
        const diffLines = diffPromptLines(
          parentPrompt[field],
          revisedPrompt[field]
        )
        return (
          <section key={field}>
            <h4 className="text-xs font-medium text-muted-foreground">
              {label}
              {!hasPromptChanges(diffLines) && "（変更なし）"}
            </h4>
            <pre className="mt-1 max-h-48 overflow-auto rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
              {diffLines.map((diffLine) => (
                <div
                  key={diffLine.lineKey}
                  className={
                    diffLine.kind === "added"
                      ? "bg-green-100 text-green-900"
                      : diffLine.kind === "removed"
                        ? "bg-red-100 text-red-900 line-through"
                        : ""
                  }
                >
                  {diffLine.kind === "added"
                    ? "+ "
                    : diffLine.kind === "removed"
                      ? "- "
                      : "  "}
                  {diffLine.text}
                </div>
              ))}
            </pre>
          </section>
        )
      })}
    </div>
  )
}
