/**
 * ルーブリック採点（教員の層）の main 側（docs/vlm-grading-design.md §4・§5-2）。
 *
 * - 項目の作成・変更は §6-4 の規則で検証し、外れたものは書かない
 * - 適用は操作者自身の採点行に付け外しし、行が無ければ用意する。付け外しで手での上書きの印が外れる
 * - 項目を消すと適用はカスケードで消える
 * - 計算し直しの材料は、適用のある全採点者の採点行を返す
 * - 項目から計算した点の書き込みは、上書きの印の立った行を（解除の指示が無ければ）飛ばす
 * - 採点キーで付けた点は、そのマスに適用があれば上書きの印を立てる
 * - 類型方式の設問（§4-8-6）: 項目は類型表の類型にする・無答・保留だけ。項目から計算した類型を書き、
 *   方式と合わない判定・ほかの類型表の類型は書かない。類型のキーも適用のあるマスでは上書きになる
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  setQuestionScore,
  updateQuestionScore,
} from "@/electron-src/lib/prisma/questionScoreWrite"
import {
  getRubricRecalculationSource,
  listRubricApplicationsByCropRegion,
  setRubricApplications,
} from "@/electron-src/lib/prisma/rubricApplication"
import {
  createRubricItem,
  deleteRubricItem,
  listRubricItemsByCropRegion,
  setCropRegionScoringMethod,
  updateRubricItem,
} from "@/electron-src/lib/prisma/rubricItem"
import { writeRubricScores } from "@/electron-src/lib/prisma/rubricScoreWrite"
import { setScaleLevels } from "@/electron-src/lib/prisma/scaleLevelScoreWrite"
import {
  createScoreScale,
  setCropRegionScoreScale,
} from "@/electron-src/lib/prisma/scoreScale"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
let otherUserId: string

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: 2,
    includeScores: false,
  })
  const otherUser = await testPrisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: `other_${crypto.randomUUID()}`,
      name: "別の採点者",
    },
  })
  otherUserId = otherUser.id
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const cropRegionId = () => fixture.cropRegions[0].id
const ownerId = () => fixture.user.id
const examStudentId = (index: number) => fixture.examStudents[index].id

const createDeduction = (pointDelta: number) =>
  createRubricItem(
    {
      cropRegionId: cropRegionId(),
      label: "単位が無い",
      adviceText: "単位を書こう",
      sortOrder: 0,
      effectKind: "adjust",
      pointDelta,
      setStatus: null,
      setScore: null,
      setScaleLevelId: null,
    },
    ownerId()
  )

describe("ルーブリック項目", () => {
  it("作成・変更・並び順の取得ができ、Decimal の列は数で比べられる", async () => {
    const item = await createDeduction(-2)
    expect(item.createdByUserId).toBe(ownerId())
    expect(item.pointDelta?.toNumber()).toBe(-2)
    expect(item.createdBy).not.toHaveProperty("passcode")

    const updated = await updateRubricItem(
      item.id,
      {
        label: "途中式が無い",
        effect: {
          effectKind: "set",
          pointDelta: null,
          setStatus: "partial",
          setScore: 3,
          setScaleLevelId: null,
        },
      },
      ownerId()
    )
    expect(updated.effectKind).toBe("set")
    expect(updated.pointDelta).toBeNull()
    expect(updated.setScore?.toNumber()).toBe(3)

    const listed = await listRubricItemsByCropRegion(cropRegionId())
    expect(listed.map((listedItem) => listedItem.id)).toEqual([item.id])

    const auditActions = await testPrisma.auditLog.findMany({
      where: { entityId: item.id },
    })
    expect(auditActions.map((auditLog) => auditLog.action).sort()).toEqual([
      "exam.rubric_item.create",
      "exam.rubric_item.update",
    ])
  })

  it("規則に外れた効き方は書かない（配点を超える減点・満点の部分点）", async () => {
    await expect(createDeduction(-11)).rejects.toThrow("0〜10 点")
    await expect(
      createRubricItem(
        {
          cropRegionId: cropRegionId(),
          label: "",
          adviceText: "",
          sortOrder: 0,
          effectKind: "set",
          pointDelta: null,
          setStatus: "partial",
          setScore: 10,
          setScaleLevelId: null,
        },
        ownerId()
      )
    ).rejects.toThrow("正答の項目")
    expect(await listRubricItemsByCropRegion(cropRegionId())).toHaveLength(0)
  })

  it("採点方式を変えられ、知らない方式は拒む", async () => {
    const updated = await setCropRegionScoringMethod(
      cropRegionId(),
      "deduction",
      ownerId()
    )
    expect(updated.scoringMethod).toBe("deduction")
    await expect(
      setCropRegionScoringMethod(cropRegionId(), "rank", ownerId())
    ).rejects.toThrow("採点方式")
  })
})

describe("適用", () => {
  it("行の無いマスに当てると採点行を用意し、外すと適用だけが消える", async () => {
    const item = await createDeduction(-2)
    const touched = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0), examStudentId(1)],
        applied: true,
      },
      ownerId()
    )
    expect(touched).toHaveLength(2)
    expect(touched.every((row) => row.status === "unscored")).toBe(true)
    expect(touched.every((row) => row.userId === ownerId())).toBe(true)
    expect(touched.map((row) => row.rubricApplications.length).sort()).toEqual([
      1, 1,
    ])

    // 2度当てても重ならない
    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    expect(
      await listRubricApplicationsByCropRegion(cropRegionId())
    ).toHaveLength(2)

    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: false,
      },
      ownerId()
    )
    expect(
      await listRubricApplicationsByCropRegion(cropRegionId())
    ).toHaveLength(1)
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: cropRegionId() },
      })
    ).toBe(2)
  })

  it("別の設問の項目は当てられない", async () => {
    const otherRegion = await testPrisma.cropRegion.create({
      data: {
        examPageId: fixture.pages[0].id,
        label: "問2",
        type: "QUESTION_ANSWER",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        points: 5,
      },
    })
    const item = await createDeduction(-2)
    await expect(
      setRubricApplications(
        {
          cropRegionId: otherRegion.id,
          rubricItemId: item.id,
          examStudentIds: [examStudentId(0)],
          applied: true,
        },
        ownerId()
      )
    ).rejects.toThrow("この設問のもの")
  })

  it("項目を消すと適用もカスケードで消える", async () => {
    const item = await createDeduction(-2)
    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    await deleteRubricItem(item.id, ownerId())
    expect(await listRubricApplicationsByCropRegion(cropRegionId())).toEqual([])
  })
})

describe("計算し直しの材料と点の書き込み", () => {
  it("材料は適用のある全採点者の行を、適用と採点者を同梱して返す", async () => {
    const item = await createDeduction(-2)
    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(1)],
        applied: true,
      },
      otherUserId
    )
    // 適用の無い行は入らない
    await setQuestionScore({
      cropRegionId: cropRegionId(),
      examStudentId: examStudentId(1),
      userId: ownerId(),
      status: "correct",
      partialScore: null,
    })

    const source = await getRubricRecalculationSource(cropRegionId())
    expect(source?.scoringMethod).toBe("points")
    expect(source?.rubricItems.map((rubricItem) => rubricItem.id)).toEqual([
      item.id,
    ])
    expect(
      source?.questionScores.map((questionScore) => questionScore.userId).sort()
    ).toEqual([ownerId(), otherUserId].sort())
    expect(
      source?.questionScores.every(
        (questionScore) =>
          questionScore.rubricApplications.length === 1 &&
          !("passcode" in questionScore.user)
      )
    ).toBe(true)
  })

  it("他の採点者の行も書き、上書きの印の行は解除の指示が無ければ飛ばす", async () => {
    const item = await createDeduction(-2)
    const [ownRow] = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    const [otherRow] = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      otherUserId
    )
    // 自分の行は採点キーで上書きする（適用があるので印が立つ）
    await updateQuestionScore(ownRow.id, {
      status: "correct",
      partialScore: null,
    })
    expect(
      (await testPrisma.questionScore.findUnique({ where: { id: ownRow.id } }))
        ?.overridesRubric
    ).toBe(true)

    const result = await writeRubricScores(
      [
        {
          questionScoreId: ownRow.id,
          status: "partial",
          partialScore: 8,
          scaleLevelId: null,
          clearsOverride: false,
        },
        {
          questionScoreId: otherRow.id,
          status: "partial",
          partialScore: 8,
          scaleLevelId: null,
          clearsOverride: false,
        },
        {
          questionScoreId: crypto.randomUUID(),
          status: "partial",
          partialScore: 8,
          scaleLevelId: null,
          clearsOverride: false,
        },
      ],
      ownerId()
    )
    expect(result.writtenQuestionScoreIds).toEqual([otherRow.id])
    expect(result.skippedOverriddenIds).toEqual([ownRow.id])
    expect(result.deletedQuestionScoreIds).toHaveLength(1)

    const writtenOther = await testPrisma.questionScore.findUnique({
      where: { id: otherRow.id },
    })
    expect(writtenOther?.status).toBe("partial")
    expect(writtenOther?.partialScore?.toNumber()).toBe(8)
    expect(writtenOther?.userId).toBe(otherUserId)

    const recalculated = await testPrisma.auditLog.findFirst({
      where: { action: "exam.rubric.recalculate_others" },
    })
    expect(recalculated?.userId).toBe(ownerId())

    // 上書きを解除して書くと、印が外れて点が入る
    await writeRubricScores(
      [
        {
          questionScoreId: ownRow.id,
          status: "partial",
          partialScore: 8,
          scaleLevelId: null,
          clearsOverride: true,
        },
      ],
      ownerId()
    )
    const clearedOwn = await testPrisma.questionScore.findUnique({
      where: { id: ownRow.id },
    })
    expect(clearedOwn?.overridesRubric).toBe(false)
    expect(clearedOwn?.partialScore?.toNumber()).toBe(8)
  })

  it("採点キーの点は、適用の無いマスでは上書きの印を立てず、付け外しで印が外れる", async () => {
    const plain = await setQuestionScore({
      cropRegionId: cropRegionId(),
      examStudentId: examStudentId(0),
      userId: ownerId(),
      status: "correct",
      partialScore: null,
    })
    expect(plain.overridesRubric).toBe(false)

    const item = await createDeduction(-2)
    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    const overridden = await setQuestionScore({
      cropRegionId: cropRegionId(),
      examStudentId: examStudentId(0),
      userId: ownerId(),
      status: "incorrect",
      partialScore: null,
    })
    expect(overridden.overridesRubric).toBe(true)

    const [afterToggle] = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: false,
      },
      ownerId()
    )
    expect(afterToggle.overridesRubric).toBe(false)
  })
})

describe("類型方式の設問", () => {
  /** 設問を類型方式にし、類型 A/B の類型表を選ぶ。ほかの類型表も1つ作る */
  const setUpScaleQuestion = async () => {
    const scoreScale = await createScoreScale(
      {
        examId: fixture.exam.id,
        name: "記述",
        levels: [
          { label: "A", score: 10 },
          { label: "B", score: 6 },
        ],
      },
      ownerId()
    )
    const otherScale = await createScoreScale(
      {
        examId: fixture.exam.id,
        name: "ほか",
        levels: [{ label: "S", score: 12 }],
      },
      ownerId()
    )
    await setCropRegionScoringMethod(cropRegionId(), "scale", ownerId())
    await setCropRegionScoreScale(cropRegionId(), scoreScale.id, ownerId())
    const [levelA, levelB] = scoreScale.levels
    return { levelA, levelB, otherLevel: otherScale.levels[0] }
  }

  const scaleItem = (setStatus: string, setScaleLevelId: string | null) =>
    createRubricItem(
      {
        cropRegionId: cropRegionId(),
        label: "根拠を2つ挙げている",
        adviceText: "",
        sortOrder: 0,
        effectKind: "set",
        pointDelta: null,
        setStatus,
        setScore: null,
        setScaleLevelId,
      },
      ownerId()
    )

  it("類型表の類型にする項目を作れ、ほかの類型表の類型・加減の項目は作れない", async () => {
    const { levelA, otherLevel } = await setUpScaleQuestion()
    const item = await scaleItem("evaluated", levelA.id)
    expect(item.setStatus).toBe("evaluated")
    expect(item.setScaleLevelId).toBe(levelA.id)
    expect(item.setScore).toBeNull()

    await expect(scaleItem("evaluated", otherLevel.id)).rejects.toThrow(
      "類型表の類型ではありません"
    )
    await expect(scaleItem("correct", null)).rejects.toThrow()
    await expect(createDeduction(-1)).rejects.toThrow("加減する項目")
  })

  it("類型を変えると監査ログに類型の記号の前後が残る", async () => {
    const { levelA, levelB } = await setUpScaleQuestion()
    const item = await scaleItem("evaluated", levelA.id)
    await updateRubricItem(
      item.id,
      {
        effect: {
          effectKind: "set",
          pointDelta: null,
          setStatus: "evaluated",
          setScore: null,
          setScaleLevelId: levelB.id,
        },
      },
      ownerId()
    )
    const updateLog = await testPrisma.auditLog.findFirst({
      where: { entityId: item.id, action: "exam.rubric_item.update" },
    })
    expect(JSON.parse(updateLog?.metadata ?? "{}").changes).toContainEqual({
      field: "setScaleLevel",
      label: "類型",
      before: "A",
      after: "B",
    })
  })

  it("項目から計算した類型を書き、部分点は書かない。合わない判定・ほかの類型表の類型は書かない", async () => {
    const { levelA, otherLevel } = await setUpScaleQuestion()
    const item = await scaleItem("evaluated", levelA.id)
    const [touched] = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    const write = {
      questionScoreId: touched.id,
      status: "evaluated" as const,
      partialScore: 3,
      scaleLevelId: levelA.id,
      clearsOverride: false,
    }
    await writeRubricScores([write], ownerId())
    const written = await testPrisma.questionScore.findUniqueOrThrow({
      where: { id: touched.id },
    })
    expect(written.status).toBe("evaluated")
    expect(written.scaleLevelId).toBe(levelA.id)
    expect(written.partialScore).toBeNull()

    await expect(
      writeRubricScores(
        [{ ...write, status: "partial", scaleLevelId: null }],
        ownerId()
      )
    ).rejects.toThrow("正答・誤答・部分点を書けません")
    await expect(
      writeRubricScores([{ ...write, scaleLevelId: otherLevel.id }], ownerId())
    ).rejects.toThrow("類型表の類型ではありません")

    // 保留は類型を外して書く
    await writeRubricScores(
      [
        {
          ...write,
          status: "pending",
          partialScore: null,
          scaleLevelId: levelA.id,
        },
      ],
      ownerId()
    )
    const pending = await testPrisma.questionScore.findUniqueOrThrow({
      where: { id: touched.id },
    })
    expect(pending.status).toBe("pending")
    expect(pending.scaleLevelId).toBeNull()
  })

  it("類型方式でない設問には類型を書かない", async () => {
    const item = await createDeduction(-1)
    const [touched] = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    await expect(
      writeRubricScores(
        [
          {
            questionScoreId: touched.id,
            status: "evaluated",
            partialScore: null,
            scaleLevelId: null,
            clearsOverride: false,
          },
        ],
        ownerId()
      )
    ).rejects.toThrow("類型を書けません")
  })

  it("適用のあるマスで類型のキーを押すと手での上書きになり、計算し直しの材料に類型表の類型が載る", async () => {
    const { levelA, levelB } = await setUpScaleQuestion()
    const item = await scaleItem("evaluated", levelA.id)
    await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId: item.id,
        examStudentIds: [examStudentId(0)],
        applied: true,
      },
      ownerId()
    )
    const [overridden, plain] = await Promise.all([
      setScaleLevels(
        {
          cropRegionId: cropRegionId(),
          examStudentIds: [examStudentId(0)],
          scaleLevelId: levelB.id,
        },
        ownerId()
      ),
      setScaleLevels(
        {
          cropRegionId: cropRegionId(),
          examStudentIds: [examStudentId(1)],
          scaleLevelId: levelB.id,
        },
        ownerId()
      ),
    ])
    expect(overridden[0].overridesRubric).toBe(true)
    expect(plain[0].overridesRubric).toBe(false)

    const source = await getRubricRecalculationSource(cropRegionId())
    expect(source?.scoreScale?.levels.map((level) => level.id).sort()).toEqual(
      [levelA.id, levelB.id].sort()
    )
  })
})
