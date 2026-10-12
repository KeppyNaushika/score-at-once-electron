import { ArrowLeftRight, Ban, Shuffle } from "lucide-react"

import { CodeRefToken } from "./CodeRefToken"
import type { GlossaryTermId } from "./glossaryTerms"
import { GLOSSARY_TERM_IDS } from "./glossaryTerms"
import { HighlightedText } from "./HighlightedText"
import type { GlossaryTerm, GlossaryText } from "./types"

/** 語ごとの見出しの id（索引・「似た語との違い」から飛ぶ先） */
export function glossaryTermAnchorId(termId: GlossaryTermId): string {
  return `glossary-term-${termId}`
}

/**
 * 用語集の語1つ。**呼び名のすぐ後ろに、指す表・列・値・型を並べる。**
 *
 * 辞書の1項のように、枠で囲まず罫線で区切る。説明の下に「別の表記」「使わない語」
 * 「似た語との違い」を、行頭の印で見分けられるように置く。
 */
export function GlossaryTermEntry({
  glossaryTerm,
  glossaryText,
  normalizedQuery,
  onJumpToTerm,
}: {
  glossaryTerm: GlossaryTerm
  glossaryText: GlossaryText
  normalizedQuery: string
  onJumpToTerm: (termId: GlossaryTermId) => void
}) {
  const termText = glossaryText.terms[glossaryTerm.id]
  // 並びは用語集の語の順（書いた順に左右されない）
  const distinctionEntries = GLOSSARY_TERM_IDS.flatMap((otherTermId) => {
    const distinction = termText.distinctions[otherTermId]
    return distinction === undefined ? [] : [{ otherTermId, distinction }]
  })

  return (
    <article
      id={glossaryTermAnchorId(glossaryTerm.id)}
      data-glossary-term-id={glossaryTerm.id}
      className="scroll-mt-16 border-b py-5 last:border-b-0"
    >
      <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-lg leading-tight font-semibold tracking-tight">
          <HighlightedText
            text={termText.label}
            normalizedQuery={normalizedQuery}
          />
        </span>
        {glossaryTerm.codeRefs.map((codeRef, codeRefIndex) => (
          <CodeRefToken
            key={codeRefIndex}
            codeRef={codeRef}
            glossaryText={glossaryText}
          />
        ))}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
        <HighlightedText
          text={termText.summary}
          normalizedQuery={normalizedQuery}
        />
      </p>
      {(termText.variants.length > 0 ||
        termText.avoidedAliases.length > 0 ||
        distinctionEntries.length > 0) && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {termText.variants.length > 0 && (
            <>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <Shuffle className="size-3.5" />
                {glossaryText.ui.variants}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {termText.variants.map((variant) => (
                  <span
                    key={variant}
                    className="rounded bg-muted px-1.5 text-foreground/80"
                  >
                    <HighlightedText
                      text={variant}
                      normalizedQuery={normalizedQuery}
                    />
                  </span>
                ))}
              </dd>
            </>
          )}
          {termText.avoidedAliases.length > 0 && (
            <>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <Ban className="size-3.5 text-destructive/70" />
                {glossaryText.ui.avoidedAliases}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {termText.avoidedAliases.map((avoidedAlias) => (
                  <span
                    key={avoidedAlias}
                    className="rounded bg-destructive/10 px-1.5 text-destructive line-through decoration-destructive/50"
                  >
                    <HighlightedText
                      text={avoidedAlias}
                      normalizedQuery={normalizedQuery}
                    />
                  </span>
                ))}
              </dd>
            </>
          )}
          {distinctionEntries.length > 0 && (
            <>
              <dt className="flex items-start gap-1 pt-0.5 text-xs text-muted-foreground">
                <ArrowLeftRight className="mt-px size-3.5" />
                {glossaryText.ui.distinctions}
              </dt>
              <dd>
                <ul className="space-y-1">
                  {distinctionEntries.map(({ otherTermId, distinction }) => (
                    <li key={otherTermId} className="leading-relaxed">
                      <button
                        type="button"
                        onClick={() => onJumpToTerm(otherTermId)}
                        className="mr-2 font-medium underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
                      >
                        {glossaryText.terms[otherTermId].label}
                      </button>
                      <span className="text-foreground/80">{distinction}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      )}
    </article>
  )
}
