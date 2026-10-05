// @vitest-environment jsdom
/**
 * 8. 採点確定の一覧の選択（useFinalizeScreen ＋ 07 と同じ AnswerGridView）。
 *
 * ここで固定すること:
 * - 何も選んでいなければ先頭の答案を選んでいるものとする
 * - 最初の Ctrl/Cmd+クリックでも、その先頭の答案を選択から落とさない
 *   （以前は足し引きの元を「利用者が選んだ答案」だけにしていたので、
 *   押した答案1つだけの選択になっていた）
 *
 * 裁定サマリの取得（useFinalizeData）は差し替え、一覧に並べる答案だけを渡す。
 */

import "../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import type { DecisionGridItem } from "@/components/exams/08-finalize/hooks/useFinalizeData"
import { useFinalizeScreen } from "@/components/exams/08-finalize/hooks/useFinalizeScreen"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")
const CURRENT_USER_ID = "user-1"
const CROP_REGION_ID = "crop-region-1"
const EXAM_PAGE_ID = "exam-page-1"
const EXAM_STUDENT_IDS = ["s1", "s2", "s3", "s4"]

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

/** 食い違いが残る答案（既定の絞り込みに残る） */
function decisionGridItemOf(
  examStudentId: string,
  index: number
): DecisionGridItem {
  return {
    id: examStudentId,
    examStudentId,
    studentName: `生徒 ${index + 1}`,
    imageUrl: `appimg:///answers/${index + 1}.png`,
    status: "unscored",
    maxScore: 4,
    questionRegion: cropRegion,
    customOrder: index,
    cell: {
      examStudentId,
      studentName: `生徒 ${index + 1}`,
      cropRegionId: CROP_REGION_ID,
      reason: "conflict",
      proposals: [],
      decision: null,
      scoreImpact: 4,
    },
  }
}

const gridItems = EXAM_STUDENT_IDS.map(decisionGridItemOf)

vi.mock("@/components/exams/08-finalize/hooks/useFinalizeData", () => ({
  useFinalizeData: () => ({
    exam: undefined,
    summary: null,
    loading: false,
    error: null,
    refresh: async () => undefined,
    decisionQuestions: [],
    decisionCropRegions: [cropRegion],
    currentCropRegionId: CROP_REGION_ID,
    currentQuestion: null,
    currentCropRegion: cropRegion,
    gridItems,
    masterAnswerData: null,
  }),
}))

/** main の代わり。一覧が読む設定と注釈は空で返す */
function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: {
        getUserPreference: vi.fn(async () => null),
        getUserKeyboardShortcuts: vi.fn(async () => ({})),
        listUserScoringStatusColors: vi.fn(async () => []),
        listUserClickScoringActions: vi.fn(async () => []),
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

/** 採点確定の画面（ScoreFinalizeMainView）と同じつなぎ方 */
function FinalizeGridHarness() {
  const finalizeScreen = useFinalizeScreen("exam-1")
  return (
    <>
      <output data-testid="selection">
        {finalizeScreen.visibleIds
          .filter((examStudentId) =>
            finalizeScreen.selectedIds.has(examStudentId)
          )
          .join(",")}
      </output>
      <AnswerGridView
        allScoringData={finalizeScreen.visibleItems}
        masterAnswerData={null}
        filteredScoringDataIds={finalizeScreen.visibleIds}
        selectedScoringDataIds={finalizeScreen.selectedIds}
        onScoringDataSelect={finalizeScreen.handleSelectAnswer}
        onScoringDataReplace={(ids) =>
          finalizeScreen.setSelection(new Set(ids))
        }
        layoutDirection="right-down"
        itemsPerRow={[4]}
        autoScroll={false}
        currentUserId={CURRENT_USER_ID}
      />
    </>
  )
}

describe("採点確定の一覧の選択", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
  })

  it("最初の Cmd+クリックでも、先頭の答案を選択から落とさない", async () => {
    const user = userEvent.setup()
    renderWithProviders(<FinalizeGridHarness />)
    // 何も選んでいなければ先頭の答案を選んでいるものとする
    expect(selectedIdsShown()).toEqual(["s1"])

    await user.keyboard("{Meta>}")
    await user.click(cellOf("s3"))
    await user.keyboard("{/Meta}")

    expect(selectedIdsShown()).toEqual(["s1", "s3"])
  })

  it("Ctrl+クリックで足したあと、先頭の答案も Ctrl+クリックで外せる", async () => {
    const user = userEvent.setup()
    renderWithProviders(<FinalizeGridHarness />)

    await user.keyboard("{Control>}")
    await user.click(cellOf("s2"))
    await user.keyboard("{/Control}")
    expect(selectedIdsShown()).toEqual(["s1", "s2"])

    await user.keyboard("{Control>}")
    await user.click(cellOf("s1"))
    await user.keyboard("{/Control}")
    expect(selectedIdsShown()).toEqual(["s2"])
  })
})
