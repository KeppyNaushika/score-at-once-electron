// @vitest-environment jsdom
/**
 * 07 の AI採点モードで、設問を切り替えても一覧の絞り込みと並べ方を変えない。
 *
 * ここで固定すること:
 * - 自分の採点・AI の採点の絞り込みと並べ方は、設問を切り替えても残る
 *   （作業場は設問ごとに作り直すので、これらは AI採点モードの根が持つ）
 * - 答案の選択は設問ごとのもので、設問を切り替えたら既定（先頭の答案）に戻る
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingMode } from "@/components/exams/07-score-at-once/AiGrading/AiGradingMode"
import type { AiGridDisplaySettings } from "@/components/exams/07-score-at-once/AiGrading/types"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeStudentAnswerImage,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")
const SECOND_CROP_REGION_ID = "crop-region-2"

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const SETTINGS: AiGradingSettings = {
  defaultProvider: "anthropic",
  defaultModels: { anthropic: "claude-opus-5-5", openai: "gpt-5.5" },
  defaultEffort: "medium",
  defaultMode: "realtime",
  concurrency: 4,
  budgetWarningUsd: null,
  openaiCompatibleBaseUrl: null,
  anthropicPricingSourceUrl: "https://example.test/pricing",
  openaiPricingSourceUrl: "https://example.test/openai-pricing",
  defaultAnnotationInstruction: "",
}

function makeCropRegion(
  id: string,
  label: string,
  orderIndex: number
): QuestionAnswerRegionRow {
  return {
    id,
    examPageId: EXAM_PAGE_ID,
    label,
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1 + orderIndex * 0.3,
    width: 0.5,
    height: 0.2,
    points: 4,
    orderIndex,
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
}

const cropRegions = [
  makeCropRegion(CROP_REGION_ID, "1-(1)", 0),
  makeCropRegion(SECOND_CROP_REGION_ID, "1-(2)", 1),
]

const studentAnswerImages = ["s1", "s2", "s3"].map((examStudentId) =>
  makeStudentAnswerImage(examStudentId)
)

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
  onAnnotationChanged: () => undefined,
}

const NO_QUESTION_SCORES = new Map<string, QuestionScoreRow[]>()

/** main の代わり。AI の実行もプロンプトも無い設問として返す */
function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      aiGrading: {
        listPrompts: vi.fn(async () => []),
        listRuns: vi.fn(async () => []),
        listRunsByExam: vi.fn(async () => []),
        measureInk: vi.fn(async () => []),
        onRunProgress: vi.fn(() => () => undefined),
      },
      aiProvider: {
        getSettings: vi.fn(async () => SETTINGS),
        getModelCatalogs: vi.fn(async () => ({
          anthropic: null,
          openai: null,
        })),
        getPricing: vi.fn(async () => ({
          modelPrices: [],
          batchPricePercents: { anthropic: null, openai: null },
        })),
      },
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

/** 採点画面と同じく、今の設問は AI採点モードの外が持つ */
function AiGradingModeHarness() {
  const [currentCropRegionId, setCurrentCropRegionId] = useState(CROP_REGION_ID)
  const currentCropRegion = cropRegions.find(
    (cropRegion) => cropRegion.id === currentCropRegionId
  )
  return (
    <AiGradingMode
      examId="exam-1"
      currentUserId={CURRENT_USER_ID}
      cropRegions={cropRegions}
      currentCropRegion={currentCropRegion}
      onCropRegionChange={(cropRegion) => {
        if (cropRegion) setCurrentCropRegionId(cropRegion.id)
      }}
      onPrevQuestion={() => setCurrentCropRegionId(CROP_REGION_ID)}
      onNextQuestion={() => setCurrentCropRegionId(SECOND_CROP_REGION_ID)}
      questionProgress={{}}
      isQuestionSetFiltered={false}
      studentAnswerImages={studentAnswerImages}
      questionScoresByCropRegionId={NO_QUESTION_SCORES}
      pageSize="A4"
      unlockedProviders={["anthropic"]}
      display={display}
      unreflectedAiQuestionIds={new Set()}
    />
  )
}

function renderMode() {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>
          <AiGradingModeHarness />
        </ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

function filterButton(groupLabel: string, buttonLabel: string): HTMLElement {
  return within(screen.getByRole("group", { name: groupLabel })).getByRole(
    "button",
    { name: buttonLabel }
  )
}

function answerOrderButton(label: string): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: "並べ方" })).getByRole(
    "radio",
    { name: label }
  )
}

/** 「表示」節の見出しの右の件数（選択 n | 表示 n | 全体 n） */
function shownCounts(): string {
  const counts = screen.getByText(
    (_content, element) =>
      element?.tagName === "SPAN" &&
      (element.textContent ?? "").trim().startsWith("選択")
  )
  return (counts.textContent ?? "").replace(/\s+/g, " ").trim()
}

function cellOf(answerId: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-answer-id="${answerId}"]`
  )
  if (!cell) throw new Error(`答案 ${answerId} のマスが描かれていません`)
  return cell
}

async function switchToSecondQuestion(
  user: ReturnType<typeof userEvent.setup>
) {
  const previousSection = screen.getByRole("region", {
    name: "答案と AI の判定",
  })
  await user.click(screen.getByRole("button", { name: /1-\(2\)/ }))
  // 作業場が作り直されたこと（設問ごとの作業場を key で作り直している）
  await waitFor(() =>
    expect(screen.getByRole("region", { name: "答案と AI の判定" })).not.toBe(
      previousSection
    )
  )
}

describe("AI採点モード: 設問を切り替えても絞り込みと並べ方を変えない", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
  })

  it("自分の採点・AI の採点の絞り込みと並べ方が残る", async () => {
    const user = userEvent.setup()
    renderMode()
    await screen.findByRole("group", { name: "AI の採点の絞り込み" })

    // 既定から変える: AI の採点の「未採点」を入、自分の採点の「正答」を入、
    // 並べ方を確信度の低い順
    await user.click(filterButton("AI の採点の絞り込み", "未採点"))
    await user.click(filterButton("自分の採点の絞り込み", "正答"))
    await user.click(answerOrderButton("確信度の低い順"))

    const expectChangedSettings = () => {
      expect(filterButton("AI の採点の絞り込み", "未採点")).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      expect(filterButton("自分の採点の絞り込み", "正答")).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      expect(answerOrderButton("確信度の低い順")).toHaveAttribute(
        "aria-checked",
        "true"
      )
    }
    expectChangedSettings()

    await switchToSecondQuestion(user)
    expectChangedSettings()
  })

  it("答案の選択は設問を切り替えると既定（先頭の答案）に戻る", async () => {
    const user = userEvent.setup()
    renderMode()
    await screen.findByRole("group", { name: "AI の採点の絞り込み" })

    // AI の判定が無い答案も出す（3件とも見える）
    await user.click(filterButton("AI の採点の絞り込み", "未採点"))
    await waitFor(() => expect(shownCounts()).toContain("表示 3"))

    await user.keyboard("{Meta>}")
    await user.click(cellOf("s3"))
    await user.keyboard("{/Meta}")
    expect(shownCounts()).toContain("選択 2")

    await switchToSecondQuestion(user)
    await waitFor(() => expect(shownCounts()).toContain("表示 3"))
    expect(shownCounts()).toContain("選択 1")
  })
})
