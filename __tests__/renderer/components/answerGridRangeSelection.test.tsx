// @vitest-environment jsdom
/**
 * 07 の一覧（AnswerGridView）の範囲選択。一覧表示と AI採点モードで同じ部品を使う。
 *
 * ここで固定すること:
 * - Shift+クリックで広げた選択は、離した（mouseup）あとも範囲のまま残る
 *   （以前は押した瞬間にドラッグ扱いになり、離したときに押した答案1つの範囲で
 *   選択を置き換えていた）
 * - Ctrl/Cmd+クリックで足した選択も残る
 * - 修飾キー無しのクリックは、その答案1つだけを選ぶ
 * - ドラッグは囲んだ答案で選択を置き換える
 *
 * イベントは userEvent で、実際のブラウザと同じ順（pointerdown → mousedown →
 * pointerup → mouseup → click）で起こす。
 */

import "../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingGrid } from "@/components/exams/07-score-at-once/AiGrading/AiGradingGrid"
import { useAiGridSelection } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridSelection"
import { useAiGridViewSettings } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridViewSettings"
import type { AiGridDisplaySettings } from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeAttemptWithRun,
} from "../aiGrading/helpers/aiGradingRowFixtures"

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const cropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 4,
  orderIndex: 0,
  scoringMethod: "points",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  cropSubtotals: [],
}

/** main の代わり。一覧が読む設定と注釈は空で返す */
function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: {
        getUserPreference: vi.fn(async () => null),
        getUserKeyboardShortcuts: vi.fn(async () => ({})),
        listUserScoringStatusColors: vi.fn(async () => []),
      },
      drawing: { getByCropRegion: vi.fn(async () => []) },
    },
    writable: true,
    configurable: true,
  })
}

function renderWithProviders(children: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>{children}</ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

function cellOf(answerId: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-answer-id="${answerId}"]`
  )
  if (!cell) throw new Error(`答案 ${answerId} のマスが描かれていません`)
  return cell
}

function selectedIdsShown(): string[] {
  const text = screen.getByTestId("selection").textContent ?? ""
  return text === "" ? [] : text.split(",")
}

/**
 * マスを横一列に 100px 間隔で並べたことにする（jsdom は配置を計算しないので、
 * ドラッグの囲みの判定に使う位置を与える）
 */
function layOutCellsInRow(answerIds: string[]) {
  answerIds.forEach((answerId, index) => {
    const left = index * 100
    cellOf(answerId).getBoundingClientRect = () => ({
      x: left,
      y: 0,
      left,
      top: 0,
      width: 80,
      height: 80,
      right: left + 80,
      bottom: 80,
      toJSON: () => ({}),
    })
  })
}

/**
 * 押して、座標を順に動かして、最後の座標で離す。
 *
 * 動かす間も宛先は押したマスのままにする。user-event はマスをまたぐときの
 * mouseout に relatedTarget を付けないので、React はグリッドの外へ出たと読んで
 * グリッドの onMouseLeave を起こしてしまう（実際のブラウザでは起きない）。
 * 選択の判定は座標だけで決まるので、宛先を固定しても確かめる中身は変わらない
 */
async function dragWithinCell(
  user: ReturnType<typeof userEvent.setup>,
  pressedCell: HTMLElement,
  path: { clientX: number; clientY: number }[]
) {
  const [pressAt, ...moves] = path
  const releaseAt = moves.at(-1) ?? pressAt
  await user.pointer([
    { keys: "[MouseLeft>]", target: pressedCell, coords: pressAt },
    ...moves.map((coords) => ({ target: pressedCell, coords })),
    { keys: "[/MouseLeft]", target: pressedCell, coords: releaseAt },
  ])
}

// ---------------------------------------------------------------------------
// 一覧表示
// ---------------------------------------------------------------------------

const LIST_ANSWER_IDS = ["answer-1", "answer-2", "answer-3", "answer-4"]

function scoringDataOf(answerId: string, index: number): ScoringData {
  return {
    id: answerId,
    examStudentId: `exam-student-${index + 1}`,
    studentName: `生徒 ${index + 1}`,
    imageUrl: `appimg:///answers/${index + 1}.png`,
    maxScore: 4,
    status: "unscored",
    questionRegion: cropRegion,
    customOrder: index,
  }
}

/** 一覧表示と同じく、選択を親が持ち、足し引きは前の値から作る */
function ListGridHarness() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([LIST_ANSWER_IDS[0]])
  )
  return (
    <>
      <output data-testid="selection">
        {LIST_ANSWER_IDS.filter((answerId) => selectedIds.has(answerId)).join(
          ","
        )}
      </output>
      <AnswerGridView
        allScoringData={LIST_ANSWER_IDS.map(scoringDataOf)}
        masterAnswerData={null}
        filteredScoringDataIds={LIST_ANSWER_IDS}
        selectedScoringDataIds={selectedIds}
        onScoringDataSelect={(answerId, isSelected) =>
          setSelectedIds((prev) => {
            const next = new Set(prev)
            if (isSelected) {
              next.add(answerId)
            } else {
              next.delete(answerId)
            }
            return next
          })
        }
        onScoringDataReplace={(answerIds) => setSelectedIds(new Set(answerIds))}
        layoutDirection="right-down"
        itemsPerRow={[4]}
        autoScroll={false}
        currentCropRegion={cropRegion}
        currentUserId={CURRENT_USER_ID}
        pageSize="A4"
      />
    </>
  )
}

describe("一覧表示の範囲選択", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
  })

  it("Shift+クリックで広げた選択は、離したあとも範囲のまま残る", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ListGridHarness />)

    await user.keyboard("{Shift>}")
    await user.click(cellOf("answer-3"))
    await user.keyboard("{/Shift}")

    expect(selectedIdsShown()).toEqual(["answer-1", "answer-2", "answer-3"])
  })

  it("Ctrl+クリック・Cmd+クリックで足した選択も残る", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ListGridHarness />)

    await user.keyboard("{Control>}")
    await user.click(cellOf("answer-3"))
    await user.keyboard("{/Control}")
    expect(selectedIdsShown()).toEqual(["answer-1", "answer-3"])

    await user.keyboard("{Meta>}")
    await user.click(cellOf("answer-4"))
    await user.keyboard("{/Meta}")
    expect(selectedIdsShown()).toEqual(["answer-1", "answer-3", "answer-4"])
  })

  it("修飾キー無しのクリックは、選択中の答案を押してもその1つだけを選ぶ", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ListGridHarness />)

    await user.keyboard("{Shift>}")
    await user.click(cellOf("answer-3"))
    await user.keyboard("{/Shift}")
    await user.click(cellOf("answer-2"))

    expect(selectedIdsShown()).toEqual(["answer-2"])
  })

  it("ドラッグは囲んだ答案で選択を置き換える", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ListGridHarness />)
    layOutCellsInRow(LIST_ANSWER_IDS)

    await dragWithinCell(user, cellOf("answer-2"), [
      { clientX: 110, clientY: 10 },
      { clientX: 250, clientY: 40 },
      { clientX: 310, clientY: 40 },
    ])

    expect(selectedIdsShown()).toEqual(["answer-2", "answer-3", "answer-4"])
  })
})

// ---------------------------------------------------------------------------
// AI採点モード
// ---------------------------------------------------------------------------

const AI_EXAM_STUDENT_IDS = ["s1", "s2", "s3", "s4"]

const display: AiGridDisplaySettings = {
  layoutDirection: "right-down",
  onLayoutDirectionChange: () => undefined,
  itemsPerLine: [4],
  onItemsPerLineChange: () => undefined,
  expandMargin: 0,
  onExpandMarginChange: () => undefined,
  autoScroll: false,
  showStudentNames: true,
  annotationRefreshKey: 0,
}

const reviewedAnswers = AI_EXAM_STUDENT_IDS.map((examStudentId) => {
  // 既定の絞り込み（自分が未採点で AI の判定がある）に残るよう、AI の判定を持たせる
  const answer = makeAnswer(examStudentId, {
    attempts: [
      makeAttemptWithRun({ examStudentId, id: `attempt-${examStudentId}` }),
    ],
  })
  return {
    answer,
    review: reviewAnswer(answer, {
      chosenAttemptIdByExamStudentId: new Map(),
      selectedPromptId: "prompt-1",
      points: 4,
    }),
  }
})

/** AI採点の作業場と同じつなぎ方（選択は useAiGridSelection が持つ） */
function AiGridHarness() {
  const viewSettings = useAiGridViewSettings()
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers,
    layoutDirection: display.layoutDirection,
    itemsPerLine: display.itemsPerLine,
    viewSettings,
  })
  return (
    <>
      <output data-testid="selection">
        {grid.visibleIds
          .filter((examStudentId) => grid.selectedIds.has(examStudentId))
          .join(",")}
      </output>
      <AiGradingGrid
        cropRegion={cropRegion}
        currentUserId={CURRENT_USER_ID}
        pageSize="A4"
        display={display}
        visibleItems={grid.visibleItems}
        visibleIds={grid.visibleIds}
        selectedIds={grid.selectedIds}
        onSelect={grid.handleSelectAnswer}
        onReplaceSelection={(ids) => grid.setSelection(new Set(ids))}
        totalCount={grid.gridItems.length}
      />
    </>
  )
}

describe("AI採点モードの範囲選択", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
  })

  it("Shift+クリックで広げた選択は、離したあとも範囲のまま残る", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiGridHarness />)
    // 何も選んでいなければ先頭の答案を選んでいるものとする
    expect(selectedIdsShown()).toEqual(["s1"])

    await user.keyboard("{Shift>}")
    await user.click(cellOf("s3"))
    await user.keyboard("{/Shift}")

    expect(selectedIdsShown()).toEqual(["s1", "s2", "s3"])
  })

  it("最初の Ctrl/Cmd+クリックでも、先頭の答案を選択から落とさない", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiGridHarness />)

    await user.keyboard("{Meta>}")
    await user.click(cellOf("s3"))
    await user.keyboard("{/Meta}")

    expect(selectedIdsShown()).toEqual(["s1", "s3"])
  })

  it("ドラッグは囲んだ答案で選択を置き換える", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiGridHarness />)
    layOutCellsInRow(AI_EXAM_STUDENT_IDS)

    await dragWithinCell(user, cellOf("s2"), [
      { clientX: 110, clientY: 10 },
      { clientX: 250, clientY: 40 },
    ])

    expect(selectedIdsShown()).toEqual(["s2", "s3"])
  })
})
