import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { codeRefName } from "./glossaryTerms"
import type {
  GlossaryCodeRef,
  GlossaryCodeRefKind,
  GlossaryText,
} from "./types"

/** 種別ごとの色。札の左の種別名と枠に使い、名前そのものは等幅の地の色で読ませる */
const CODE_REF_KIND_CLASS: Record<GlossaryCodeRefKind, string> = {
  table:
    "border-sky-200 text-sky-700 dark:border-sky-900 dark:text-sky-300 [&>[data-kind]]:bg-sky-50 dark:[&>[data-kind]]:bg-sky-950",
  column:
    "border-violet-200 text-violet-700 dark:border-violet-900 dark:text-violet-300 [&>[data-kind]]:bg-violet-50 dark:[&>[data-kind]]:bg-violet-950",
  value:
    "border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300 [&>[data-kind]]:bg-amber-50 dark:[&>[data-kind]]:bg-amber-950",
  identifier:
    "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300 [&>[data-kind]]:bg-emerald-50 dark:[&>[data-kind]]:bg-emerald-950",
}

/**
 * 語が指す表・列・値・型の札。押すと名前をコピーする（コードや issue に貼るため）。
 */
export function CodeRefToken({
  codeRef,
  glossaryText,
}: {
  codeRef: GlossaryCodeRef
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
      title={glossaryText.ui.copyHint}
      className={cn(
        "inline-flex max-w-full items-stretch overflow-hidden rounded border text-xs leading-5 transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        CODE_REF_KIND_CLASS[codeRef.kind]
      )}
    >
      <span data-kind className="shrink-0 px-1.5 font-medium">
        {glossaryText.codeRefKinds[codeRef.kind]}
      </span>
      <code className="truncate bg-background px-1.5 font-mono text-foreground">
        {name}
      </code>
    </button>
  )
}
