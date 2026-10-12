import { CornerDownRight } from "lucide-react"
import type { ReactNode } from "react"

import { CodeRefToken } from "./CodeRefToken"
import type { GlossaryTermId } from "./glossaryTerms"
import { GLOSSARY_TERM_IDS } from "./glossaryTerms"
import { HighlightedText } from "./HighlightedText"
import type { GlossaryTerm, GlossaryText } from "./types"

/** 語ごとの見出しの id（索引・「似た語との違い」から飛ぶ先） */
export function glossaryTermAnchorId(termId: GlossaryTermId): string {
  return `glossary-term-${termId}`
}

/** 説明の下の1行。見出しの幅を揃え、どの語でも同じ位置から読み始められるようにする */
function EntryNote({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 pt-px text-[11px] text-muted-foreground/60">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

/**
 * 用語集の語1つ。**呼び名と同じ行に、指す表・列・値・型を右に揃えて並べる。**
 *
 * 辞書の1項のように、枠で囲まず罫線で区切る。表・列は色の札にせず等幅の控えめな文字に
 * して、日本語の見出し語がいちばん先に目に入るようにする。説明の下に「別の表記」
 * 「使わない語」「似た語との違い」を、見出しの幅を揃えて置く。
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
  const tableModels = new Set(
    glossaryTerm.codeRefs.flatMap((codeRef) =>
      codeRef.kind === "table" ? [codeRef.model] : []
    )
  )

  return (
    <article
      id={glossaryTermAnchorId(glossaryTerm.id)}
      data-glossary-term-id={glossaryTerm.id}
      className="scroll-mt-20 border-b border-border/60 py-7 last:border-b-0"
    >
      <h3 className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span className="text-[22px] leading-tight font-semibold tracking-tight">
          <HighlightedText
            text={termText.label}
            normalizedQuery={normalizedQuery}
          />
        </span>
        {glossaryTerm.codeRefs.length > 0 && (
          <span className="-mr-1 ml-auto flex flex-wrap items-baseline justify-end gap-x-2.5 gap-y-0.5 font-normal">
            {glossaryTerm.codeRefs.map((codeRef, codeRefIndex) => (
              <CodeRefToken
                key={codeRefIndex}
                codeRef={codeRef}
                tableModels={tableModels}
                glossaryText={glossaryText}
              />
            ))}
          </span>
        )}
      </h3>
      <p className="mt-3 text-base leading-8 text-foreground">
        <HighlightedText
          text={termText.summary}
          normalizedQuery={normalizedQuery}
        />
      </p>
      {(termText.variants.length > 0 ||
        termText.avoidedAliases.length > 0 ||
        distinctionEntries.length > 0) && (
        <dl className="mt-4 space-y-1 text-[12.5px] leading-6 text-muted-foreground">
          {termText.variants.length > 0 && (
            <EntryNote label={glossaryText.ui.variants}>
              <span>
                {termText.variants.map((variant, variantIndex) => (
                  <span key={variant}>
                    {variantIndex > 0 && (
                      <span className="text-muted-foreground/40">、</span>
                    )}
                    <HighlightedText
                      text={variant}
                      normalizedQuery={normalizedQuery}
                    />
                  </span>
                ))}
              </span>
            </EntryNote>
          )}
          {termText.avoidedAliases.length > 0 && (
            <EntryNote label={glossaryText.ui.avoidedAliases}>
              {termText.avoidedAliases.map((avoidedAlias, aliasIndex) => (
                <span key={avoidedAlias}>
                  {aliasIndex > 0 && (
                    <span className="text-muted-foreground/40">、</span>
                  )}
                  <span className="text-destructive/55 line-through decoration-destructive/30">
                    <HighlightedText
                      text={avoidedAlias}
                      normalizedQuery={normalizedQuery}
                    />
                  </span>
                </span>
              ))}
            </EntryNote>
          )}
          {distinctionEntries.length > 0 && (
            <EntryNote label={glossaryText.ui.distinctions}>
              <ul className="space-y-1">
                {distinctionEntries.map(({ otherTermId, distinction }) => (
                  <li key={otherTermId} className="flex gap-1.5">
                    <CornerDownRight className="mt-1.5 size-3 shrink-0 text-muted-foreground/40" />
                    <span>
                      <button
                        type="button"
                        onClick={() => onJumpToTerm(otherTermId)}
                        className="mr-1.5 font-medium text-foreground/70 underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
                      >
                        {glossaryText.terms[otherTermId].label}
                      </button>
                      <span>{distinction}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </EntryNote>
          )}
        </dl>
      )}
    </article>
  )
}
