/**
 * 段の一覧と、実際のルートの対応を固定する。
 *
 * 段の番号は**フォルダ名に入っている**（`08-finalize` / `09-export`）。段を1つ
 * 挟むと後ろが全部ずれ、`layout.tsx`・`useNavigationHistory`・ヘルプ・
 * 出力前警告の行き先といった離れた場所を同時に直すことになる。直し漏れは
 * 型検査にもユニットテストにも掛からない —— 文字列のまま存在しないURLを指し、
 * 押した人だけが 404 に落ちる。
 *
 * そこで2つを走査で押さえる:
 *
 * 1. 段の `id` と `src/app` のフォルダが1対1であること（片方だけ増減させない）
 * 2. 改名した古い名前（`08-export`）が `src` / `electron-src` / `__tests__` の
 *    どこにも残っていないこと
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import type { WorkflowPhaseGroup } from "@/lib/workflowTabs"
import {
  answerSheetBuilderWorkflowPhases,
  answerSheetBuilderWorkflowTabs,
  courseworkWorkflowPhases,
  courseworkWorkflowTabs,
  examWorkflowPhases,
  examWorkflowTabs,
  findWorkflowStepLabel,
  gradeWorkflowPhases,
  gradeWorkflowTabs,
} from "@/lib/workflowTabs"

const REPO_ROOT = path.resolve(__dirname, "../..")

/**
 * この検査そのもの。**古い名前を探す側が古い名前を書いている**ので、自分を
 * 数えると必ず落ちる。名前を分割して書く手もあるが、それをすると検査の意図が
 * 読めなくなるので、1つだけ除いて素直に書く
 */
const THIS_TEST_FILE = path.join(__dirname, "workflowStepDefinitions.test.ts")

/** 段のあるワークフローと、その実体ページが置かれたフォルダ */
const WORKFLOWS: {
  name: string
  tabs: readonly WorkflowTab[]
  phases: readonly WorkflowPhaseGroup[]
  routeDir: string
}[] = [
  {
    name: "試験",
    tabs: examWorkflowTabs,
    phases: examWorkflowPhases,
    routeDir: "src/app/(app)/exams/[examId]",
  },
  {
    name: "成績算出",
    tabs: gradeWorkflowTabs,
    phases: gradeWorkflowPhases,
    routeDir: "src/app/(app)/grades/[gradeId]",
  },
  {
    name: "試験外成績資料",
    tabs: courseworkWorkflowTabs,
    phases: courseworkWorkflowPhases,
    routeDir: "src/app/(app)/coursework/[courseworkId]",
  },
  {
    name: "解答用紙作成",
    tabs: answerSheetBuilderWorkflowTabs,
    phases: answerSheetBuilderWorkflowPhases,
    routeDir: "src/app/(app)/answer-sheet-builder/[definitionId]",
  },
]

/** 実体フォルダ直下の、ページを持つサブフォルダ名（＝段のフォルダ） */
function stepFolderNames(routeDir: string): string[] {
  const absoluteDir = path.join(REPO_ROOT, routeDir)
  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(absoluteDir, entry.name, "page.tsx"))
    )
    .map((entry) => entry.name)
    .sort()
}

/**
 * `src` と `electron-src` と `__tests__` の TypeScript ファイルを全部集める。
 *
 * `electron-src` を外すと、出力・アーカイブ・ヘルプの文言が main 側に持っている
 * 段のURLが走査から漏れる（renderer だけ直して main が古い名前を指したままでも緑になる）。
 */
function collectSourceFiles(): string[] {
  const collected: string[] = []
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "test-results") {
          continue
        }
        walk(entryPath)
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        collected.push(entryPath)
      }
    }
  }
  walk(path.join(REPO_ROOT, "src"))
  walk(path.join(REPO_ROOT, "electron-src"))
  walk(path.join(REPO_ROOT, "__tests__"))
  return collected
}

describe("段の一覧と実際のルート", () => {
  it.each(WORKFLOWS)(
    "$name の段は、ページを持つフォルダと過不足なく一致する",
    ({ tabs, routeDir }) => {
      // 概要は実体そのもののURLなので、段のフォルダを持たない
      const declaredStepIds = tabs
        .filter((tab) => tab.path !== "")
        .map((tab) => tab.id)
        .sort()

      expect(declaredStepIds).toEqual(stepFolderNames(routeDir))
    }
  )

  it.each(WORKFLOWS)("$name の段の path は id をそのまま継ぐ", ({ tabs }) => {
    tabs
      .filter((tab) => tab.path !== "")
      .forEach((tab) => {
        // 履歴のラベルは URL の第3セグメントを id で引く。ここがずれると、
        // タブは正しいのに履歴だけ段の名前を落とす
        expect(tab.path).toBe(`/${tab.id}`)
      })
  })

  it("試験には 8. 採点確定 と 9. 結果 が、この順で並ぶ", () => {
    const stepLabels = examWorkflowTabs
      .filter((tab) => tab.path !== "")
      .map((tab) => tab.label)

    expect(stepLabels.slice(-2)).toEqual(["8. 採点確定", "9. 結果"])
  })

  it.each(WORKFLOWS)(
    "$name の段カードは、段を1つずつ過不足なく束ねる",
    ({ tabs, phases }) => {
      // 概要は段ではないのでカードに載らない
      const stepIds = tabs
        .filter((tab) => tab.path !== "")
        .map((tab) => tab.id)
        .sort()
      const groupedStepIds = phases
        .flatMap((phase) => phase.stepIds)
        .slice()
        .sort()

      // 段を1つ足してカードへ入れ忘れると、タブには在るのに概要から消える。
      // 二重に入れると同じ段が2枚のカードに出る
      expect(groupedStepIds).toEqual(stepIds)
    }
  )

  it("履歴のラベルは同じ一覧から引ける（写しを持たない）", () => {
    expect(findWorkflowStepLabel(examWorkflowTabs, "08-finalize")).toBe(
      "8. 採点確定"
    )
    expect(findWorkflowStepLabel(examWorkflowTabs, "09-export")).toBe("9. 結果")
    // 概要は段ではないので引かない（引けると履歴に「概要」が二重で出る）
    expect(findWorkflowStepLabel(examWorkflowTabs, "detail")).toBeUndefined()
    expect(findWorkflowStepLabel(examWorkflowTabs, undefined)).toBeUndefined()
  })
})

/**
 * 段の長い名前（`title`）は3か所で同じものを言う——ヘッダーの見出し、「次へ」の
 * 文言、一覧の「次のステップ」。前2つは `workflowTabs` から出るが、3つ目の梯子
 * （`src/lib/*Status.ts`）は自分で文字列を持っている。**同じ段を違う名前で呼ぶと、
 * 一覧から入った人とタブから入った人が別の画面だと思う。**
 */
describe("段の題と「次のステップ」の文言", () => {
  const LADDERS: { file: string; tabs: readonly WorkflowTab[] }[] = [
    { file: "src/lib/examStatus.ts", tabs: examWorkflowTabs },
    { file: "src/lib/gradeStatus.ts", tabs: gradeWorkflowTabs },
    { file: "src/lib/courseworkStatus.ts", tabs: courseworkWorkflowTabs },
    {
      file: "src/lib/answerSheetStatus.ts",
      tabs: answerSheetBuilderWorkflowTabs,
    },
  ]

  it.each(LADDERS)(
    "$file の text は、どれかの段の title と一致する",
    ({ file, tabs }) => {
      const source = fs.readFileSync(path.join(REPO_ROOT, file), "utf-8")
      const ladderTexts = [...source.matchAll(/^\s*text: "([^"]+)",$/gm)].map(
        (match) => match[1]
      )
      // 梯子が空なら検査が素通りする（段が減ったのか、書き方が変わったのか分からない）
      expect(ladderTexts.length).toBeGreaterThan(0)

      const titles = tabs.map((tab) => tab.title)
      ladderTexts.forEach((text) => expect(titles).toContain(text))
    }
  )
})

/**
 * 段のページは自分の題を出さない。
 *
 * タブに段の名前が出るようになってからは、`PageHeader` を置くと**同じ段の名前が
 * 上下に2回**並ぶ。題・使い方・次へは `WorkflowTabHeader` の持ち物にしたので、
 * 段の側に戻ってきていないことを走査で押さえる。
 */
describe("段のページの題", () => {
  const WORKFLOW_DIRS = [
    "src/app/(app)/exams/[examId]",
    "src/app/(app)/grades/[gradeId]",
    "src/app/(app)/coursework/[courseworkId]",
    "src/app/(app)/answer-sheet-builder/[definitionId]",
    "src/components/exams",
    "src/components/grades",
    "src/components/coursework",
    "src/components/answer-sheet-builder",
  ]

  it("段の画面は PageHeader を被らない（題はヘッダーが1回だけ出す）", () => {
    const offenders = collectSourceFiles()
      .filter((filePath) =>
        WORKFLOW_DIRS.some((dir) =>
          filePath.startsWith(path.join(REPO_ROOT, dir) + path.sep)
        )
      )
      .filter((filePath) =>
        fs
          .readFileSync(filePath, "utf-8")
          .includes("@/components/layout/PageHeader")
      )
      .map((filePath) => path.relative(REPO_ROOT, filePath))

    expect(offenders).toEqual([])
  })
})

describe("改名の取り残し", () => {
  it("08-export を指す文字列は src にも electron-src にも __tests__ にも残っていない", () => {
    const offenders = collectSourceFiles()
      .filter((filePath) => filePath !== THIS_TEST_FILE)
      .filter((filePath) =>
        fs.readFileSync(filePath, "utf-8").includes("08-export")
      )

    expect(
      offenders.map((filePath) => path.relative(REPO_ROOT, filePath))
    ).toEqual([])
  })
})
