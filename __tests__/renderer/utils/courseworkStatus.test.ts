/**
 * 試験外成績資料の「次のステップ」導出の固定。
 *
 * 一覧の各行に「次にやること」を1つだけ出すので、段の進み具合ごとに
 * どこを指すかがずれると、利用者は毎回間違った画面へ連れて行かれる。
 * ここでは「何も無い」「途中まで」「全部済んだ」の3つを固定する。
 *
 * 飛び先の URL は**手で書かない**。段のフォルダ名が変わっても文字列の期待値は
 * 一緒に変わらないので、テストは緑のままリンクだけが 404 になる。
 * 期待値は `src/app` の実在するディレクトリから引く。
 */
import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import type { CourseworkProgressSource } from "@/lib/courseworkStatus"
import { getCourseworkStatus } from "@/lib/courseworkStatus"

const REPO_ROOT = path.resolve(__dirname, "../../..")
const COURSEWORK_ROUTE_DIR = path.join(
  REPO_ROOT,
  "src/app/(app)/coursework/[courseworkId]"
)

/** 実在する段のディレクトリ（`NN-*`）を段番号で引く表 */
const stepSegmentByNumber = new Map<number, string>(
  fs
    .readdirSync(COURSEWORK_ROUTE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => [Number(entry.name.slice(0, 2)), entry.name])
)

const COURSEWORK_ID = "coursework-1"

/** 段番号から、その段の実在するパスを組む */
function urlOfStep(step: number): string {
  const segment = stepSegmentByNumber.get(step)
  if (!segment) {
    throw new Error(
      `段 ${step} のページが ${COURSEWORK_ROUTE_DIR} に見つかりません`
    )
  }
  return `/coursework/${COURSEWORK_ID}/${segment}`
}

/**
 * 判定は件数しか見ないが、入力型は Prisma の行から導いてあるので**行を丸ごと**渡す。
 * 件数だけ指定できるよう、中身は使わない値で埋める。
 */
const AT = new Date("2026-04-01T00:00:00.000Z")

function buildStudents(count: number): CourseworkProgressSource["students"] {
  return Array.from({ length: count }, (_, index) => ({
    id: `coursework-student-${index + 1}`,
    createdAt: AT,
    updatedAt: AT,
    courseworkId: COURSEWORK_ID,
    studentId: `student-${index + 1}`,
    customOrder: null,
  }))
}

function buildItems(count: number): CourseworkProgressSource["items"] {
  return Array.from({ length: count }, (_, index) => ({
    id: `coursework-item-${index + 1}`,
    name: `評価項目${index + 1}`,
    createdAt: AT,
    updatedAt: AT,
    courseworkId: COURSEWORK_ID,
    order: index,
    maxScore: 100,
    inputMode: "numeric",
  }))
}

function buildCoursework(
  studentCount: number,
  itemCount: number
): CourseworkProgressSource {
  return {
    id: COURSEWORK_ID,
    students: buildStudents(studentCount),
    items: buildItems(itemCount),
  }
}

describe("getCourseworkStatus", () => {
  it("資料のワークフローは 02〜05 の4段である", () => {
    // 段が増減したらここが落ちる（次のステップの導出も見直しが要る）
    expect([...stepSegmentByNumber.keys()].sort()).toEqual([2, 3, 4, 5])
  })

  it("何も無いときは生徒管理を指す", () => {
    const status = getCourseworkStatus(buildCoursework(0, 0))

    expect(status.step).toBe(2)
    expect(status.text).toBe("生徒の登録")
    expect(status.url).toBe(urlOfStep(2))
  })

  it("生徒だけ登録されているときは評価項目を指す", () => {
    const status = getCourseworkStatus(buildCoursework(1, 0))

    expect(status.step).toBe(3)
    expect(status.text).toBe("評価項目の設定")
    expect(status.url).toBe(urlOfStep(3))
  })

  it("評価項目だけあって生徒がいないときは、先に生徒管理を指す", () => {
    // 段は前から順に埋める。後ろの段が埋まっていても手前の穴を先に出す
    const status = getCourseworkStatus(buildCoursework(0, 1))

    expect(status.step).toBe(2)
    expect(status.url).toBe(urlOfStep(2))
  })

  it("生徒と評価項目が揃ったら点数入力を指し続ける", () => {
    // 点数（CourseworkScore）は一覧が読んでいないので入力済みかは判定できない。
    // 試験・成績が最後の段を指し続けるのと同じく、ここが行き止まりになる
    const status = getCourseworkStatus(buildCoursework(2, 1))

    expect(status.step).toBe(4)
    expect(status.text).toBe("点数の入力")
    expect(status.url).toBe(urlOfStep(4))
  })
})
