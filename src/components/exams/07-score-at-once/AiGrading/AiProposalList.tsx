"use client"

import { Check, CircleDashed, MessageSquareText } from "lucide-react"

import { rubricEffectLabel } from "../Rubric/utils/rubricEffectLabel"
import {
  type AiRubricProposalRow,
  latestProposalResponse,
} from "./utils/rubricProposals"

interface AiProposalListProps {
  /** 問いかける順の案 */
  orderedProposals: readonly AiRubricProposalRow[]
  /** いま問いかけている案（一覧では畳まずに上に出しているので、印だけ付ける） */
  currentProposalId: string | null
  onOpen: (proposalId: string) => void
}

/** 答えの一言（選んだ選択肢の効き方か、「その他」の指示） */
function describeAnswer(proposal: AiRubricProposalRow): string | null {
  const latest = latestProposalResponse(proposal)
  if (!latest) return null
  if (latest.optionId === null) return `その他：${latest.freeText}`
  const option = proposal.options.find(
    (candidate) => candidate.id === latest.optionId
  )
  return option ? rubricEffectLabel(option) : "選んだ選択肢"
}

/**
 * 案の一覧（答えた案は答えを畳んで残す）。押すとその案を開き、選び直せる
 */
export function AiProposalList({
  orderedProposals,
  currentProposalId,
  onOpen,
}: AiProposalListProps) {
  if (orderedProposals.length === 0) return null
  return (
    <ol className="space-y-0.5" aria-label="項目の案の一覧">
      {orderedProposals.map((proposal) => {
        const answer = describeAnswer(proposal)
        const isCurrent = proposal.id === currentProposalId
        const isInstruction =
          latestProposalResponse(proposal)?.optionId === null
        const memberCount = new Set(
          proposal.members.map((member) => member.attempt.examStudentId)
        ).size
        return (
          <li key={proposal.id}>
            <button
              type="button"
              aria-current={isCurrent ? "true" : undefined}
              className={`flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-[11px] ${
                isCurrent ? "bg-amber-100" : "hover:bg-gray-50"
              }`}
              onClick={() => onOpen(proposal.id)}
            >
              {answer === null ? (
                <CircleDashed className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
              ) : isInstruction ? (
                <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0 text-sky-600" />
              ) : (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-gray-800">{proposal.label}</span>
                <span className="text-gray-500">（{memberCount}件）</span>
                <span className="block truncate text-gray-500">
                  {answer ?? "未回答"}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
