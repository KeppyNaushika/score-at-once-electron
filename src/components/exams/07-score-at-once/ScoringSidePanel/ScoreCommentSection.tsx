"use client"

import { useMutation } from "@tanstack/react-query"
import { NotebookPen } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { useShortcutContext } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import { Textarea } from "@/components/ui/textarea"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { setQuestionScoreCommentMutation } from "@/queries/scoring"

import { SidePanelSection } from "./SidePanelSection"

interface ScoreCommentSectionProps {
  examId: string
  currentCropRegion: QuestionAnswerRegionRow | null | undefined
  currentExamStudentId: string | undefined
  currentUserId: string
  isOpen: boolean
  onToggle: () => void
  /** 畳んである節をショートカットから開くため（開閉は設定に残る） */
  onEnsureOpen: () => void
}

/**
 * いま選んでいるマスに、その点にした理由の覚え書きを書く。
 *
 * **07 はキーで採点を回す画面なので、文字入力欄にフォーカスが吸われると採点が止まる。**
 * そこで出入りを明示的に決める:
 *
 * - **入る**: `scoring.comment`（既定 `k`）。畳んであれば開いてから中へ入れる。
 *   `when` は他の採点キーと同じ `!inputFocus && !modalOpen && hasSelectedAnswers` で、
 *   採点中にだけ効く（すでに文字を打っているときは `k` はただの `k`）
 * - **出る**: `Escape`（書きかけを捨てて戻る）／`Ctrl`(`⌘`)`+Enter`（残して戻る）／
 *   欄の外を触る（残して戻る）。`Enter` 単体は改行（覚え書きは複数行を書く）
 *
 * 出るときは `inputFocus` を自分で false へ戻す。`ShortcutProvider` は `focusout` を
 * `focusin` と同じ処理に通しており、離れる側の要素を見て `inputFocus` を true のまま
 * 据え置く（次に入力欄でないものが focus を取るまで戻らない）。フォーカスが body へ
 * 抜けると戻る機会が来ないので、採点キーが黙って死ぬ。部分点モーダルも同じ手当てを
 * している（usePartialScore）。
 */
export function ScoreCommentSection({
  examId,
  currentCropRegion,
  currentExamStudentId,
  currentUserId,
  isOpen,
  onToggle,
  onEnsureOpen,
}: ScoreCommentSectionProps) {
  const { keyBindings } = useKeyBindings()
  const { setContextValue } = useShortcutContext()
  // 節を開いた直後に欄へ入るので、DOM が生えたことを描画で知る必要がある
  // （ref オブジェクトでは生えたことに気づけない）
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null)
  // 「節を開いてから入る」の“開いた後”を待つ合図。描画には出ないので state にしない
  const pendingFocus = useRef(false)

  const { mutate: saveComment } = useMutation(
    setQuestionScoreCommentMutation(examId)
  )

  // 保存済みの覚え書き。行がまだ無ければ空（列は NULL を持たない）
  const savedComment =
    currentCropRegion && currentExamStudentId
      ? (findQuestionScore(
          currentCropRegion,
          currentExamStudentId,
          currentUserId
        )?.comment ?? "")
      : ""

  // 書きかけ。マスを移ったら保存済みの値へ戻す（前のマスの書きかけを持ち越さない）
  const [draft, setDraft] = useState(savedComment)
  const cellKey = `${currentCropRegion?.id ?? ""}:${currentExamStudentId ?? ""}`
  const [shownCellKey, setShownCellKey] = useState(cellKey)
  if (shownCellKey !== cellKey) {
    setShownCellKey(cellKey)
    setDraft(savedComment)
  }

  const enterField = (field: HTMLTextAreaElement) => {
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }

  // 畳んだ節を開いてから呼ばれた場合は、欄が生えたこの時点で中へ入る
  useEffect(() => {
    if (!pendingFocus.current || !textarea) return
    pendingFocus.current = false
    enterField(textarea)
  }, [textarea])

  useCommand(
    "scoring.comment",
    () => {
      if (!currentCropRegion || !currentExamStudentId) return
      // 既に開いていれば欄はもう在る。畳んでいれば開いて、生えてから入る
      if (textarea) {
        enterField(textarea)
        return
      }
      pendingFocus.current = true
      onEnsureOpen()
    },
    {
      when: "!inputFocus && !modalOpen && hasSelectedAnswers",
      metadata: {
        title: "覚え書きを書く",
        category: "採点",
        description: "選んでいるマスに、その点にした理由を書きます",
      },
    }
  )

  // Esc で出るときは、blur が続けて起きても書きかけを保存しない。
  // `setDraft` は次の描画までしか効かないので、blur ハンドラが閉じ込んでいる
  // `draft` は捨てたはずの文字列のまま（＝捨てたつもりが保存される）
  const discardOnBlur = useRef(false)

  /** 欄から出る。後始末（`inputFocus` を戻す）は blur ハンドラが行う */
  const leaveField = () => {
    textarea?.blur()
  }

  const commit = (comment: string) => {
    if (!currentCropRegion || !currentExamStudentId) return
    if (comment === savedComment) return
    saveComment({
      examStudentId: currentExamStudentId,
      cropRegionId: currentCropRegion.id,
      userId: currentUserId,
      comment,
    })
  }

  const isCellSelected = Boolean(currentCropRegion && currentExamStudentId)

  return (
    <SidePanelSection
      icon={NotebookPen}
      title="覚え書き"
      collapsible
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <Textarea
        ref={setTextarea}
        value={draft}
        disabled={!isCellSelected}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          // キーを使わずマウスで欄の外を触った場合もここを通る。
          // `inputFocus` を戻すのは blur が起きた全経路の共通の後始末なので、
          // Esc / ⌘+Enter だけでなくここでも行う（戻し忘れると採点キーが死ぬ）
          setContextValue("inputFocus", false)
          if (discardOnBlur.current) {
            discardOnBlur.current = false
            return
          }
          commit(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            discardOnBlur.current = true
            setDraft(savedComment)
            leaveField()
            return
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            commit(draft)
            leaveField()
          }
        }}
        rows={3}
        className="resize-none text-xs"
        placeholder={
          isCellSelected
            ? "なぜこの点にしたか（自分用の覚え書き）"
            : "答案を選ぶと書けます"
        }
      />
      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
        {keyBindings["scoring.comment"]} で入る・Esc で捨てて戻る・⌘/Ctrl+Enter
        で残して戻る
      </p>
    </SidePanelSection>
  )
}
