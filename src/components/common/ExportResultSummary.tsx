"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

/**
 * 書き出せた1件（試験 / 解答用紙）。
 *
 * `missingFiles` が空でなければ、**中身が欠けたまま作られている**。アーカイブとしては
 * 壊れておらず取り込みも成功するので、ここで伝えないと「答案画像だけ無い試験」が
 * 警告なしで同僚の手元に届く。
 */
export interface ExportedArchive {
  /** 書き出し元の id（試験 id / 解答用紙定義 id）。一覧の key に使う */
  sourceId: string
  /** 書き出し元の名前（試験名 / 解答用紙名） */
  sourceName: string
  outputPath: string
  /** 同梱できなかったファイルの説明（例: `答案画像: 1_page1.png`） */
  missingFiles: string[]
}

/** 書き出せなかった1件 */
export interface FailedExport {
  /** 書き出し元の id。一覧の key に使う */
  sourceId: string
  sourceName: string
  error: string
}

/** 1回の書き出し操作の結果。1件でも一括でも同じ形にして、同じ見せ方に揃える */
export interface ExportOutcome {
  archives: ExportedArchive[]
  failures: FailedExport[]
}

interface ExportResultSummaryProps {
  outcome: ExportOutcome
}

/**
 * 書き出しの結果を並べる。
 *
 * 試験1件・試験の一括・解答用紙のどの経路からも同じ文言・同じ並びで見えるように、
 * 見せ方はここ1箇所に持つ。
 */
export function ExportResultSummary({ outcome }: ExportResultSummaryProps) {
  /** 欠けたファイルの一覧を開いている書き出し元 */
  const [expandedSourceIds, setExpandedSourceIds] = useState<
    ReadonlySet<string>
  >(new Set())

  const toggleExpanded = (sourceId: string) => {
    setExpandedSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  const incompleteArchives = outcome.archives.filter(
    (archive) => archive.missingFiles.length > 0
  )

  const headline =
    outcome.failures.length === 0
      ? `${outcome.archives.length}件を書き出しました`
      : `${outcome.archives.length}件を書き出し、${outcome.failures.length}件は失敗しました`

  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium">{headline}</p>

      {outcome.failures.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-medium text-destructive">失敗した書き出し</h3>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {outcome.failures.map((failure) => (
              <li key={failure.sourceId} className="break-all">
                <span className="font-medium">{failure.sourceName}</span>
                <span className="text-muted-foreground">
                  {" …… "}
                  {failure.error}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {incompleteArchives.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-medium text-orange-600">
            画像が欠けたまま書き出しました
          </h3>
          <p className="text-muted-foreground">
            受け取った側では、その画像が表示されません。
          </p>
          <ul className="space-y-1 rounded-md border p-2">
            {incompleteArchives.map((archive) => {
              const isExpanded = expandedSourceIds.has(archive.sourceId)
              return (
                <li key={archive.sourceId}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(archive.sourceId)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center gap-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span className="font-medium">{archive.sourceName}</span>
                    <span className="text-muted-foreground">
                      {" …… "}
                      {archive.missingFiles.length}件
                    </span>
                  </button>
                  {isExpanded && (
                    // ファイル名は改行で並べる（同じ名前が複数あり得るので key を作らない）
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap">
                      {archive.missingFiles.join("\n")}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {outcome.archives.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-medium">保存先</h3>
          {outcome.archives.length === 1 ? (
            <p className="break-all text-muted-foreground">
              {outcome.archives[0].outputPath}
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {outcome.archives.map((archive) => (
                <li key={archive.sourceId} className="break-all">
                  <span className="font-medium">{archive.sourceName}</span>
                  <span className="text-muted-foreground">
                    {" …… "}
                    {archive.outputPath}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
