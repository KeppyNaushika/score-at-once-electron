import { Copy } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { codeRefName } from "./glossaryTerms"
import type {
  GlossaryCodeRef,
  GlossaryCodeRefKind,
  GlossaryText,
} from "./types"

/**
 * 種別ごとの色。色は小さな種別名にだけ付け、名前は地の色で読ませる
 * （色の付いた札が並ぶと、日本語の見出し語より目立ってしまう）
 */
const CODE_REF_KIND_CLASS: Record<GlossaryCodeRefKind, string> = {
  table: "text-sky-600 dark:text-sky-400",
  column: "text-violet-600 dark:text-violet-400",
  value: "text-amber-700 dark:text-amber-400",
  identifier: "text-emerald-600 dark:text-emerald-400",
}

/**
 * 同じ語に表が並んでいれば、その表の列は「.列名」と短く見せる
 * （`StudentClassroomMembership.startDate` が並ぶと行が折り返して読めない）。
 * コピーするのは常に完全な名前
 */
function shortCodeRefName(
  codeRef: GlossaryCodeRef,
  tableModels: ReadonlySet<string>
): string {
  if (codeRef.kind === "column" && tableModels.has(codeRef.model)) {
    return `.${codeRef.field}`
  }
  return codeRefName(codeRef)
}

/**
 * 語が指す表・列・値・型。押すと完全な名前をコピーする（コードや issue に貼るため）。
 */
export function CodeRefToken({
  codeRef,
  tableModels,
  glossaryText,
}: {
  codeRef: GlossaryCodeRef
  /** 同じ語に並んでいる表（列の名前を短くするため） */
  tableModels: ReadonlySet<string>
  glossaryText: GlossaryText
}) {
  const name = codeRefName(codeRef)

  const copyName = async () => {
    await navigator.clipboard.writeText(name)
    toast.success(glossaryText.ui.copied(name))
  }

  return (
    <button
      type="button"
      onClick={copyName}
      title={`${name}（${glossaryText.ui.copyHint}）`}
      className="group/token -mx-1 inline-flex max-w-full items-baseline gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          "shrink-0 text-[10px] font-semibold tracking-wide opacity-60 group-hover/token:opacity-100",
          CODE_REF_KIND_CLASS[codeRef.kind]
        )}
      >
        {glossaryText.codeRefKinds[codeRef.kind]}
      </span>
      <code className="font-mono text-xs whitespace-nowrap text-muted-foreground/70 group-hover/token:text-foreground">
        {shortCodeRefName(codeRef, tableModels)}
      </code>
      <Copy className="size-3 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover/token:opacity-100 group-focus-visible/token:opacity-100" />
    </button>
  )
}
