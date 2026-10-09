"use client"

import { Check, Send } from "lucide-react"
import type { RefObject } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { RubricItemRow } from "@/queries/rubric"

import {
  rubricEffectLabel,
  rubricItemName,
} from "../Rubric/utils/rubricEffectLabel"
import { describeMemberNames } from "./utils/questioningFlow"
import {
  type AiRubricProposalRow,
  latestProposalResponse,
  orderMembersByConfidence,
} from "./utils/rubricProposals"

interface AiProposalQuestionProps {
  proposal: AiRubricProposalRow
  /** 問いかける順での位置（1 から）と案の数 */
  position: number
  proposalCount: number
  rubricItems: readonly RubricItemRow[]
  /** 受験者の表示名 */
  nameOf: (examStudentId: string) => string
  /** 焦点のある選択肢 */
  focusedIndex: number
  /** 選択の場面で振っている番号（場面の外なら null） */
  numberOf: (optionIndex: number) => number | null
  isChoiceSceneOpen: boolean
  onFocusOption: (optionIndex: number) => void
  onAnswerOption: (optionIndex: number) => void
  /** 新しく項目を作る答えになるか（助言の文案を直せるのはこのときだけ） */
  createsRubricItem: boolean
  adviceText: string
  onAdviceTextChange: (text: string) => void
  otherText: string
  onOtherTextChange: (text: string) => void
  otherTextRef: RefObject<HTMLTextAreaElement | null>
  onAnswerOther: () => void
}

/**
 * 項目の案1つの問いかけ（docs/vlm-grading-design.md §3-5）。
 *
 * 案の名前・説明・当てはまる答案（先頭の数名の名前と「ほか N名」。名前は端末の中で引き、
 * AI には送っていない）・選択肢（推奨の印・効き方・理由）・「その他」（次の往復への指示）を並べる。
 * 選び直しのときは、いまの答えに印を付ける
 */
export function AiProposalQuestion({
  proposal,
  position,
  proposalCount,
  rubricItems,
  nameOf,
  focusedIndex,
  numberOf,
  isChoiceSceneOpen,
  onFocusOption,
  onAnswerOption,
  createsRubricItem,
  adviceText,
  onAdviceTextChange,
  otherText,
  onOtherTextChange,
  otherTextRef,
  onAnswerOther,
}: AiProposalQuestionProps) {
  const memberNames = [
    ...new Set(
      orderMembersByConfidence(proposal.members).map(
        (member) => member.attempt.examStudentId
      )
    ),
  ].map(nameOf)
  const latest = latestProposalResponse(proposal)
  const matchedItem = rubricItems.find(
    (rubricItem) => rubricItem.id === proposal.matchedRubricItemId
  )
  const resultItem = rubricItems.find(
    (rubricItem) => rubricItem.id === latest?.resultRubricItemId
  )

  return (
    <section
      aria-label={`問いかけ: ${proposal.label}`}
      className="rounded border border-amber-300 bg-amber-50/40 p-2 text-xs"
    >
      <p className="text-[10px] text-gray-500">
        案 {position} / {proposalCount}
        {latest ? "・答え直し" : ""}
      </p>
      <h4 className="text-sm font-medium text-gray-900">{proposal.label}</h4>
      {proposal.description && (
        <p className="mt-0.5 text-gray-700">{proposal.description}</p>
      )}
      <p className="mt-1 text-gray-800">
        <span className="font-medium">{memberNames.length}名</span>：
        {describeMemberNames(memberNames)}
      </p>
      {matchedItem && (
        <p className="mt-1 text-[11px] text-gray-600">
          既存の項目「{rubricItemName(matchedItem)}
          」に当たる特徴です。選ぶとこの項目を当てます（項目の値は変えません）
        </p>
      )}
      {!matchedItem && resultItem && (
        <p className="mt-1 text-[11px] text-gray-600">
          選び直すと、作った項目「{rubricItemName(resultItem)}
          」の値が変わり、当たっている答案すべての点が変わります
        </p>
      )}

      <ol className="mt-2 space-y-1" aria-label="選択肢">
        {proposal.options.map((option, optionIndex) => {
          const choiceNumber = isChoiceSceneOpen ? numberOf(optionIndex) : null
          const isFocused = optionIndex === focusedIndex
          const isCurrentAnswer = latest?.optionId === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={isFocused}
                className={`flex w-full items-start gap-1.5 rounded border px-2 py-1.5 text-left ${
                  isFocused
                    ? "border-amber-400 bg-amber-100"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
                onClick={() => onFocusOption(optionIndex)}
                onDoubleClick={() => onAnswerOption(optionIndex)}
              >
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                    choiceNumber !== null
                      ? "bg-amber-200 text-amber-900"
                      : "text-transparent"
                  }`}
                >
                  {choiceNumber ?? "·"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="font-medium text-gray-900">
                      {rubricEffectLabel(option)}
                    </span>
                    {option.recommended && (
                      <span className="rounded bg-amber-200 px-1 text-[10px] text-amber-900">
                        推奨
                      </span>
                    )}
                    {isCurrentAnswer && (
                      <span className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-800">
                        いまの答え
                      </span>
                    )}
                  </span>
                  {option.rationale && (
                    <span className="block text-[11px] text-gray-600">
                      {option.rationale}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <Button
        size="sm"
        className="mt-2 w-full"
        onClick={() => onAnswerOption(focusedIndex)}
      >
        <Check className="h-4 w-4" />
        この選択肢にして次の案へ
      </Button>

      {createsRubricItem ? (
        <label className="mt-2 block">
          <span className="text-[11px] text-gray-600">
            助言（項目の朱書きになります。空なら朱書きなし）
          </span>
          <Input
            aria-label="助言"
            className="mt-0.5 h-7 text-xs"
            value={adviceText}
            onChange={(event) => onAdviceTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.blur()
            }}
          />
        </label>
      ) : (
        proposal.adviceDraft && (
          <p className="mt-2 text-[11px] text-gray-600">
            助言の文案：
            <span className="text-red-700">{proposal.adviceDraft}</span>
          </p>
        )
      )}

      <label className="mt-2 block">
        <span className="flex items-center gap-1 text-[11px] text-gray-600">
          {isChoiceSceneOpen && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-200 text-[10px] font-semibold text-amber-900">
              0
            </span>
          )}
          その他（次の往復への指示。この案の答案は未採点のまま残ります）
        </span>
        <Textarea
          ref={otherTextRef}
          aria-label="その他の指示"
          className="mt-0.5 min-h-12 text-xs"
          placeholder="例: 途中式が無くても答が合っていれば正答にする"
          value={otherText}
          onChange={(event) => onOtherTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              onAnswerOther()
            }
            if (event.key === "Escape") event.currentTarget.blur()
          }}
        />
      </label>
      <Button
        variant="outline"
        size="sm"
        className="mt-1 w-full"
        disabled={otherText.trim() === ""}
        onClick={onAnswerOther}
      >
        <Send className="h-4 w-4" />
        指示を残して次の案へ
      </Button>
    </section>
  )
}
