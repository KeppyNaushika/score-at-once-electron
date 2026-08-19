/**
 * 個人成績通知書の設定（GradeIndividualReportSettings）の検証。
 *
 * 既定値が2箇所にある — `schema.prisma` の `@default`（行を作るとき）と、画面が使う
 * `DEFAULT_GRADE_REPORT_SETTINGS`（行がまだ無いとき）。**食い違うと、触っていない項目が
 * 保存した瞬間に変わる**（画面には既定が出ていたのに、DB は別の既定で行を作る）。
 * 型では止まらないので、実際に行を作って突き合わせる。
 *
 * あわせて「1回の書き込みが触るのは、渡した列だけ」を固定する。まるごと書く形に戻すと、
 * 続けて2つチェックを入れたときに先の1つが消える。
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  app: {
    getVersion: () => "test",
    getAppPath: () => process.cwd(),
  },
}))

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  getGradeIndividualReportSettings,
  updateGradeIndividualReportSettings,
} from "../../electron-src/lib/prisma/gradeIndividualReportSettings"
import { DEFAULT_GRADE_REPORT_SETTINGS } from "../../src/types/gradeReport.types"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

let gradeId: string

beforeAll(async () => {
  await cleanupTestDatabase()
  const grade = await prisma.grade.create({ data: { name: "1学期" } })
  gradeId = grade.id
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe("個人成績通知書の設定", () => {
  it("DB の既定と、画面が使う既定が一致する", async () => {
    const grade = await prisma.grade.create({ data: { name: "既定の確認" } })
    // 何も指定せずに行を作ると、全列が schema.prisma の `@default` で埋まる
    const row = await prisma.gradeIndividualReportSettings.create({
      data: { gradeId: grade.id },
    })

    const {
      id: _id,
      gradeId: _gradeId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...values
    } = row
    expect(values).toEqual(DEFAULT_GRADE_REPORT_SETTINGS)
  })

  it("まだ設定していなければ null（画面が既定で描く）", async () => {
    const grade = await prisma.grade.create({ data: { name: "未設定" } })

    expect(await getGradeIndividualReportSettings(grade.id)).toBeNull()
  })

  it("最初の書き込みは、渡した列以外を DB の既定で埋める", async () => {
    await updateGradeIndividualReportSettings(gradeId, { title: "通知票" })

    const settings = await getGradeIndividualReportSettings(gradeId)
    expect(settings?.title).toBe("通知票")
    expect(settings?.itemGradeFontSize).toBe(
      DEFAULT_GRADE_REPORT_SETTINGS.itemGradeFontSize
    )
  })

  it("続けて2つ変えても、両方とも残る", async () => {
    await updateGradeIndividualReportSettings(gradeId, {
      showCommentSection: true,
    })
    await updateGradeIndividualReportSettings(gradeId, {
      showSignatureSection: true,
    })

    const settings = await getGradeIndividualReportSettings(gradeId)
    expect(settings?.showCommentSection).toBe(true)
    expect(settings?.showSignatureSection).toBe(true)
    // 先に書いた分も残っている
    expect(settings?.title).toBe("通知票")
  })
})
