/**
 * 答案配置（applyStudentAnswerPlacements）が NAS 同期を越えて伝わるかの実測
 *
 * ライブラリはモックしない。端末A は本物の Prisma で `placementApply.ts` を走らせ、
 * 端末B は生SQLで覗くだけにする。確かめたいのは「A で行った配置が B にどう届くか」で、
 * そこには `_changelog` の重複排除・`_tombstone` の LWW・セカンダリ UNIQUE の畳みが
 * すべて絡む。作り物を1つでも挟むと何も確かめられない。
 *
 * 数える対象:
 * - 移動（生徒X → 生徒Y）と入れ替え（生徒X ⇄ 生徒Y）
 * - QuestionScore / DrawingAnnotation / ScoreDecision / CompoundAnswerScore /
 *   StudentAnswerImage が B 側で正しい受験者に付いているか
 * - A→B のあと B→A も回して両端末が同じ答えに落ちるか
 * - 取り込みを止める警告（UNIQUE / FOREIGN KEY / Sync failed）が出ていないか
 */
import type { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance, SyncResult } from "sqlite-nas-sync"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createPrismaClientForPath } from "../helpers/testPrismaClient"
import {
  createClientDatabase,
  createSyncInstance,
  isoMinutesAgo,
  withDatabase,
} from "./twoClientHarness"

/**
 * 端末A の Prisma を場面ごとに差し替えるための入れ物。
 *
 * `placementApply.ts` は `../client` の既定エクスポートを直に使うので、場面ごとに別DBへ
 * 向けるには読み替えを1枚挟むしかない。関数は取り出すときに本体へ束ねる
 * （`this` が Proxy のままだと Prisma の内部実装が動かない）。
 */
let activePrisma: PrismaClient | null = null

vi.mock("../../electron-src/lib/prisma/client", () => {
  const forward = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (!activePrisma) throw new Error("端末A の Prisma が未設定")
        const client = activePrisma
        const value = Reflect.get(client, property, client)
        return typeof value === "function" ? value.bind(client) : value
      },
    }
  )
  return { default: forward, getPrismaClient: () => forward }
})

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-placement-sync")
const SCHEMA_VERSION = "placement-sync-test"

// ---------------------------------------------------------------------------
// 覗き見用の読み取り（B 側は生SQL。Prisma は A にしか繋がない）
// ---------------------------------------------------------------------------

/**
 * 行1つを「どのマスに、どの中身が入っているか」で見る。
 *
 * unique を持つ表では入れ替えのとき行がマスに留まり中身が動くので、
 * `examStudentId` だけを見ても入れ替わったかは分からない。中身まで並べて数える。
 */
interface ScoreRow {
  id: string
  examStudentId: string
  content: string
}

const questionScoresOf = (dbPath: string): ScoreRow[] =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], ScoreRow>(
        `SELECT id, "examStudentId" AS examStudentId, status AS content
           FROM "QuestionScore" ORDER BY id`
      )
      .all()
  )

const scoreDecisionsOf = (dbPath: string): ScoreRow[] =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], ScoreRow>(
        `SELECT id, "examStudentId" AS examStudentId, verdict AS content
           FROM "ScoreDecision" ORDER BY id`
      )
      .all()
  )

const compoundAnswerScoresOf = (dbPath: string): ScoreRow[] =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], ScoreRow>(
        `SELECT id, "examStudentId" AS examStudentId, "recognizedAnswer" AS content
           FROM "CompoundAnswerScore" ORDER BY id`
      )
      .all()
  )

const studentAnswerImagesOf = (dbPath: string): ScoreRow[] =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], ScoreRow>(
        `SELECT id, "examStudentId" AS examStudentId, "imagePath" AS content
           FROM "StudentAnswerImage" ORDER BY id`
      )
      .all()
  )

const drawingAnnotationsOf = (
  dbPath: string
): Array<{ id: string; questionScoreId: string }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], { id: string; questionScoreId: string }>(
        `SELECT id, "questionScoreId" AS questionScoreId
           FROM "DrawingAnnotation" ORDER BY id`
      )
      .all()
  )

/** 同期を止めた（＝以後その相手から何も届かない）警告だけを拾う */
const fatalWarnings = (result: SyncResult): string[] =>
  result.warnings.filter(
    (warning) =>
      warning.includes("UNIQUE constraint failed") ||
      warning.includes("FOREIGN KEY") ||
      warning.includes("Sync failed")
  )

// ---------------------------------------------------------------------------
// 場面ごとの環境（DB 2つ + NAS 1つ）
// ---------------------------------------------------------------------------

interface Environment {
  dbA: string
  dbB: string
  syncA: SyncInstance
  syncB: SyncInstance
  prismaA: PrismaClient
}

const environments: Environment[] = []

const createEnvironment = (name: string): Environment => {
  const root = path.join(TEST_ROOT, name)
  fs.rmSync(root, { recursive: true, force: true })
  const nasPath = path.join(root, "nas")
  fs.mkdirSync(nasPath, { recursive: true })
  const dbA = path.join(root, "client-a", "database.db")
  const dbB = path.join(root, "client-b", "database.db")
  createClientDatabase(dbA)
  createClientDatabase(dbB)
  const environment: Environment = {
    dbA,
    dbB,
    syncA: createSyncInstance(dbA, "client-a", nasPath, SCHEMA_VERSION),
    syncB: createSyncInstance(dbB, "client-b", nasPath, SCHEMA_VERSION),
    prismaA: createPrismaClientForPath(dbA),
  }
  environments.push(environment)
  return environment
}

/**
 * 採点1マスまで届く骨組みを端末A へ入れる。
 *
 * 生徒2人ぶんの受験者・答案画像・採点（QuestionScore + 注釈 / ScoreDecision /
 * CompoundAnswerScore）を、`hasSecondStudentAnswers` で片方だけにも寄せられるようにする。
 */
interface Fixture {
  examPageId: string
  cropRegionId: string
  compoundAnswerId: string
  examStudentX: string
  examStudentY: string
}

const seedExam = (
  dbPath: string,
  options: { hasSecondStudentAnswers: boolean }
): Fixture => {
  const updatedAt = isoMinutesAgo(60)
  const fixture: Fixture = {
    examPageId: "exam-page-1",
    cropRegionId: "crop-region-1",
    compoundAnswerId: "compound-answer-1",
    examStudentX: "exam-student-x",
    examStudentY: "exam-student-y",
  }

  withDatabase(dbPath, (db) => {
    db.prepare(
      `INSERT INTO "Exam" (id, "examName", "markerCorrectionEnabled", "createdAt", "updatedAt")
       VALUES ('exam-1', '期末考査', 0, ?, ?)`
    ).run(updatedAt, updatedAt)

    const insertStudent = db.prepare(
      `INSERT INTO "Student"
         (id, "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    insertStudent.run(
      "student-x",
      "1001",
      "山田",
      "太郎",
      "やまだ",
      "たろう",
      updatedAt,
      updatedAt
    )
    insertStudent.run(
      "student-y",
      "1002",
      "鈴木",
      "花子",
      "すずき",
      "はなこ",
      updatedAt,
      updatedAt
    )

    db.prepare(
      `INSERT INTO "User" (id, username, name, role, "createdAt", "updatedAt")
       VALUES ('user-1', 'teacher-a', '採点者A', 'teacher', ?, ?)`
    ).run(updatedAt, updatedAt)

    db.prepare(
      `INSERT INTO "ExamPage" (id, "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt")
       VALUES (?, 'exam-1', 1, 'master/page-1.png', 'A4', ?, ?)`
    ).run(fixture.examPageId, updatedAt, updatedAt)

    db.prepare(
      `INSERT INTO "CropRegion"
         (id, "examPageId", label, type, x, y, width, height, points, "orderIndex", "createdAt", "updatedAt")
       VALUES (?, ?, '大問1(1)', 'question', 0.1, 0.1, 0.2, 0.1, 10, 0, ?, ?)`
    ).run(fixture.cropRegionId, fixture.examPageId, updatedAt, updatedAt)

    db.prepare(
      `INSERT INTO "CompoundAnswer"
         (id, "examPageId", label, "answerFormat", "correctAnswer", points, "orderIndex",
          "requireReduced", "createdAt", "updatedAt")
       VALUES (?, ?, 'アイ/ウエ', 'fraction', '-3/14', 5, 0, 0, ?, ?)`
    ).run(fixture.compoundAnswerId, fixture.examPageId, updatedAt, updatedAt)

    const insertExamStudent = db.prepare(
      `INSERT INTO "ExamStudent" (id, "examId", "studentId", status, "createdAt", "updatedAt")
       VALUES (?, 'exam-1', ?, 'participating', ?, ?)`
    )
    insertExamStudent.run(
      fixture.examStudentX,
      "student-x",
      updatedAt,
      updatedAt
    )
    insertExamStudent.run(
      fixture.examStudentY,
      "student-y",
      updatedAt,
      updatedAt
    )

    const insertImage = db.prepare(
      `INSERT INTO "StudentAnswerImage"
         (id, "examPageId", "examStudentId", "imagePath", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const insertQuestionScore = db.prepare(
      `INSERT INTO "QuestionScore"
         (id, "cropRegionId", "examStudentId", "partialScore", status, comment, "userId",
          "createdAt", "updatedAt")
       VALUES (?, ?, ?, NULL, ?, '', 'user-1', ?, ?)`
    )
    const insertAnnotation = db.prepare(
      `INSERT INTO "DrawingAnnotation"
         (id, "questionScoreId", type, x, y, color, "strokeWidth", width, height,
          "endX", "endY", "lineStyle", text, "fontSize", "textBoxWidth", "textBoxHeight",
          "horizontalAlign", "verticalAlign", "anchorDirection", "displayX", "displayY",
          "isFavorite", "createdAt", "updatedAt")
       VALUES (?, ?, 'text', 0.1, 0.1, '#ef4444', 0.5, 0, 0, 0, 0, 'solid', ?, 4.0,
               0, 0, 'left', 'top', 'top-left', 0, 0, 0, ?, ?)`
    )
    const insertScoreDecision = db.prepare(
      `INSERT INTO "ScoreDecision"
         (id, "cropRegionId", "examStudentId", verdict, score, comment,
          "decidedByUserId", "decidedAt", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, NULL, NULL, 'user-1', ?, ?, ?)`
    )
    const insertCompoundAnswerScore = db.prepare(
      `INSERT INTO "CompoundAnswerScore"
         (id, "compoundAnswerId", "examStudentId", "userId", "recognizedAnswer", status,
          "partialScore", "createdAt", "updatedAt")
       VALUES (?, ?, ?, 'user-1', ?, ?, NULL, ?, ?)`
    )

    insertImage.run(
      "image-x",
      fixture.examPageId,
      fixture.examStudentX,
      "answers/x.png",
      updatedAt,
      updatedAt
    )
    insertQuestionScore.run(
      "question-score-x",
      fixture.cropRegionId,
      fixture.examStudentX,
      "correct",
      updatedAt,
      updatedAt
    )
    insertAnnotation.run(
      "annotation-x",
      "question-score-x",
      "X の丸",
      updatedAt,
      updatedAt
    )
    insertScoreDecision.run(
      "score-decision-x",
      fixture.cropRegionId,
      fixture.examStudentX,
      "correct",
      updatedAt,
      updatedAt,
      updatedAt
    )
    insertCompoundAnswerScore.run(
      "compound-score-x",
      fixture.compoundAnswerId,
      fixture.examStudentX,
      "-3/14",
      "correct",
      updatedAt,
      updatedAt
    )

    if (options.hasSecondStudentAnswers) {
      insertImage.run(
        "image-y",
        fixture.examPageId,
        fixture.examStudentY,
        "answers/y.png",
        updatedAt,
        updatedAt
      )
      insertQuestionScore.run(
        "question-score-y",
        fixture.cropRegionId,
        fixture.examStudentY,
        "incorrect",
        updatedAt,
        updatedAt
      )
      insertAnnotation.run(
        "annotation-y",
        "question-score-y",
        "Y のバツ",
        updatedAt,
        updatedAt
      )
      insertScoreDecision.run(
        "score-decision-y",
        fixture.cropRegionId,
        fixture.examStudentY,
        "incorrect",
        updatedAt,
        updatedAt,
        updatedAt
      )
      insertCompoundAnswerScore.run(
        "compound-score-y",
        fixture.compoundAnswerId,
        fixture.examStudentY,
        "3/14",
        "incorrect",
        updatedAt,
        updatedAt
      )
    }
  })

  return fixture
}

// ---------------------------------------------------------------------------
// 場面1: 空きマスへの移動（生徒X → 生徒Y）
// ---------------------------------------------------------------------------

interface Observation {
  fromAtoB: SyncResult
  fromBtoA: SyncResult
  questionScoresB: ScoreRow[]
  scoreDecisionsB: ScoreRow[]
  compoundAnswerScoresB: ScoreRow[]
  studentAnswerImagesB: ScoreRow[]
  annotationsB: Array<{ id: string; questionScoreId: string }>
  questionScoresA: ScoreRow[]
  scoreDecisionsA: ScoreRow[]
  compoundAnswerScoresA: ScoreRow[]
  studentAnswerImagesA: ScoreRow[]
  annotationsA: Array<{ id: string; questionScoreId: string }>
}

let moveObservation: Observation
let swapObservation: Observation
let rivalObservation: Observation
let rivalQuestionScoreCountB: number

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })

  const { applyStudentAnswerPlacements } =
    await import("../../electron-src/lib/prisma/studentAnswer/placementApply")

  const observe = async (
    environment: Environment
  ): Promise<Pick<Observation, "fromAtoB" | "fromBtoA">> => {
    await environment.syncA.syncNow()
    const fromAtoB = await environment.syncB.syncNow()
    const fromBtoA = await environment.syncA.syncNow()
    return { fromAtoB, fromBtoA }
  }

  const snapshot = (
    environment: Environment,
    rounds: Pick<Observation, "fromAtoB" | "fromBtoA">
  ): Observation => ({
    ...rounds,
    questionScoresB: questionScoresOf(environment.dbB),
    scoreDecisionsB: scoreDecisionsOf(environment.dbB),
    compoundAnswerScoresB: compoundAnswerScoresOf(environment.dbB),
    studentAnswerImagesB: studentAnswerImagesOf(environment.dbB),
    annotationsB: drawingAnnotationsOf(environment.dbB),
    questionScoresA: questionScoresOf(environment.dbA),
    scoreDecisionsA: scoreDecisionsOf(environment.dbA),
    compoundAnswerScoresA: compoundAnswerScoresOf(environment.dbA),
    studentAnswerImagesA: studentAnswerImagesOf(environment.dbA),
    annotationsA: drawingAnnotationsOf(environment.dbA),
  })

  // --- 場面1: 移動 ---
  {
    const environment = createEnvironment("move")
    activePrisma = environment.prismaA
    const fixture = seedExam(environment.dbA, {
      hasSecondStudentAnswers: false,
    })
    await environment.syncA.syncNow()
    await environment.syncB.syncNow()
    await environment.syncA.syncNow()

    await applyStudentAnswerPlacements([
      {
        fileId: "image-x",
        finalExamStudentId: fixture.examStudentY,
        finalExamPageId: fixture.examPageId,
        scorePolicy: "carry",
      },
    ])

    moveObservation = snapshot(environment, await observe(environment))
  }

  // --- 場面2: 入れ替え ---
  {
    const environment = createEnvironment("swap")
    activePrisma = environment.prismaA
    const fixture = seedExam(environment.dbA, { hasSecondStudentAnswers: true })
    await environment.syncA.syncNow()
    await environment.syncB.syncNow()
    await environment.syncA.syncNow()

    await applyStudentAnswerPlacements([
      {
        fileId: "image-x",
        finalExamStudentId: fixture.examStudentY,
        finalExamPageId: fixture.examPageId,
        scorePolicy: "carry",
      },
      {
        fileId: "image-y",
        finalExamStudentId: fixture.examStudentX,
        finalExamPageId: fixture.examPageId,
        scorePolicy: "carry",
      },
    ])

    swapObservation = snapshot(environment, await observe(environment))
  }

  // --- 場面3: 相手が移動先に自分の行を持っていた ---
  {
    const environment = createEnvironment("rival")
    activePrisma = environment.prismaA
    const fixture = seedExam(environment.dbA, {
      hasSecondStudentAnswers: false,
    })
    await environment.syncA.syncNow()
    await environment.syncB.syncNow()
    await environment.syncA.syncNow()

    // 端末B の教員が、移動先マス（生徒Y × 同じ設問）を独自に採点していた
    const rivalUpdatedAt = isoMinutesAgo(30)
    withDatabase(environment.dbB, (db) => {
      db.prepare(
        `INSERT INTO "QuestionScore"
           (id, "cropRegionId", "examStudentId", "partialScore", status, comment, "userId",
            "createdAt", "updatedAt")
         VALUES ('question-score-rival', ?, ?, NULL, 'partial', '', 'user-1', ?, ?)`
      ).run(
        fixture.cropRegionId,
        fixture.examStudentY,
        rivalUpdatedAt,
        rivalUpdatedAt
      )
      db.prepare(
        `INSERT INTO "ScoreDecision"
           (id, "cropRegionId", "examStudentId", verdict, score, comment,
            "decidedByUserId", "decidedAt", "createdAt", "updatedAt")
         VALUES ('score-decision-rival', ?, ?, 'partial', NULL, NULL, 'user-1', ?, ?, ?)`
      ).run(
        fixture.cropRegionId,
        fixture.examStudentY,
        rivalUpdatedAt,
        rivalUpdatedAt,
        rivalUpdatedAt
      )
    })

    await applyStudentAnswerPlacements([
      {
        fileId: "image-x",
        finalExamStudentId: fixture.examStudentY,
        finalExamPageId: fixture.examPageId,
        scorePolicy: "carry",
      },
    ])

    // A→B→A のあと、もう1往復して収束を見る
    await environment.syncA.syncNow()
    const fromAtoB = await environment.syncB.syncNow()
    const fromBtoA = await environment.syncA.syncNow()
    await environment.syncB.syncNow()
    await environment.syncA.syncNow()

    rivalObservation = snapshot(environment, { fromAtoB, fromBtoA })
    rivalQuestionScoreCountB = rivalObservation.questionScoresB.length
  }

  activePrisma = null
}, 180_000)

afterAll(async () => {
  for (const environment of environments) {
    environment.syncA.stop()
    environment.syncB.stop()
    await environment.prismaA.$disconnect()
  }
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("答案配置は同期を越えて伝わる: 空きマスへの移動", () => {
  it("取り込みを止める警告が出ない", () => {
    expect(fatalWarnings(moveObservation.fromAtoB)).toEqual([])
    expect(fatalWarnings(moveObservation.fromBtoA)).toEqual([])
  })

  it("端末B でも採点はすべて移動先の受験者に付いている", () => {
    // 移動先のマスが空いているので、どの表も行ごと動く（id が保たれる）
    expect(moveObservation.questionScoresB).toEqual([
      {
        id: "question-score-x",
        examStudentId: "exam-student-y",
        content: "correct",
      },
    ])
    expect(moveObservation.scoreDecisionsB).toEqual([
      {
        id: "score-decision-x",
        examStudentId: "exam-student-y",
        content: "correct",
      },
    ])
    expect(moveObservation.compoundAnswerScoresB).toEqual([
      {
        id: "compound-score-x",
        examStudentId: "exam-student-y",
        content: "-3/14",
      },
    ])
    expect(moveObservation.studentAnswerImagesB).toEqual([
      {
        id: "image-x",
        examStudentId: "exam-student-y",
        content: "answers/x.png",
      },
    ])
  })

  it("手書き注釈が端末B でも生き残る", () => {
    expect(moveObservation.annotationsB).toEqual([
      { id: "annotation-x", questionScoreId: "question-score-x" },
    ])
  })

  it("両端末が同じ答えに落ちる", () => {
    expect(moveObservation.questionScoresA).toEqual(
      moveObservation.questionScoresB
    )
    expect(moveObservation.scoreDecisionsA).toEqual(
      moveObservation.scoreDecisionsB
    )
    expect(moveObservation.compoundAnswerScoresA).toEqual(
      moveObservation.compoundAnswerScoresB
    )
    expect(moveObservation.studentAnswerImagesA).toEqual(
      moveObservation.studentAnswerImagesB
    )
    expect(moveObservation.annotationsA).toEqual(moveObservation.annotationsB)
  })
})

describe("答案配置は同期を越えて伝わる: 入れ替え", () => {
  it("取り込みを止める警告が出ない", () => {
    expect(fatalWarnings(swapObservation.fromAtoB)).toEqual([])
    expect(fatalWarnings(swapObservation.fromBtoA)).toEqual([])
  })

  it("端末B でも採点が入れ替わっている", () => {
    // QuestionScore は unique を持たないので行ごと動く（子の注釈が付いてくる）
    expect(swapObservation.questionScoresB).toEqual([
      {
        id: "question-score-x",
        examStudentId: "exam-student-y",
        content: "correct",
      },
      {
        id: "question-score-y",
        examStudentId: "exam-student-x",
        content: "incorrect",
      },
    ])
    // unique を持つ3表は行がマスに留まり、中身が入れ替わる。
    // 入れ替えを unique キーの書き換えで表すと相手側で unique 違反になり、
    // その相手からの同期が永久に止まる（この場面で実測した）。
    expect(swapObservation.scoreDecisionsB).toEqual([
      {
        id: "score-decision-x",
        examStudentId: "exam-student-x",
        content: "incorrect",
      },
      {
        id: "score-decision-y",
        examStudentId: "exam-student-y",
        content: "correct",
      },
    ])
    expect(swapObservation.compoundAnswerScoresB).toEqual([
      {
        id: "compound-score-x",
        examStudentId: "exam-student-x",
        content: "3/14",
      },
      {
        id: "compound-score-y",
        examStudentId: "exam-student-y",
        content: "-3/14",
      },
    ])
    expect(swapObservation.studentAnswerImagesB).toEqual([
      {
        id: "image-x",
        examStudentId: "exam-student-x",
        content: "answers/y.png",
      },
      {
        id: "image-y",
        examStudentId: "exam-student-y",
        content: "answers/x.png",
      },
    ])
  })

  it("手書き注釈が2件とも端末B で生き残る", () => {
    expect(swapObservation.annotationsB).toEqual([
      { id: "annotation-x", questionScoreId: "question-score-x" },
      { id: "annotation-y", questionScoreId: "question-score-y" },
    ])
  })

  it("両端末が同じ答えに落ちる", () => {
    expect(swapObservation.questionScoresA).toEqual(
      swapObservation.questionScoresB
    )
    expect(swapObservation.scoreDecisionsA).toEqual(
      swapObservation.scoreDecisionsB
    )
    expect(swapObservation.compoundAnswerScoresA).toEqual(
      swapObservation.compoundAnswerScoresB
    )
    expect(swapObservation.studentAnswerImagesA).toEqual(
      swapObservation.studentAnswerImagesB
    )
    expect(swapObservation.annotationsA).toEqual(swapObservation.annotationsB)
  })
})

describe("答案配置は同期を越えて伝わる: 相手が移動先に自分の行を持っていた", () => {
  it("取り込みを止める警告が出ない", () => {
    expect(fatalWarnings(rivalObservation.fromAtoB)).toEqual([])
    expect(fatalWarnings(rivalObservation.fromBtoA)).toEqual([])
  })

  it("ScoreDecision は 1 マス 1 行へ畳まれる", () => {
    expect(rivalObservation.scoreDecisionsB).toHaveLength(1)
    expect(rivalObservation.scoreDecisionsB[0].examStudentId).toBe(
      "exam-student-y"
    )
    expect(rivalObservation.scoreDecisionsA).toEqual(
      rivalObservation.scoreDecisionsB
    )
  })

  it("QuestionScore は畳まれず両方が残る（unique が無い＝別の採点として扱う）", () => {
    expect(rivalQuestionScoreCountB).toBe(2)
    expect(rivalObservation.questionScoresA).toEqual(
      rivalObservation.questionScoresB
    )
  })

  it("移動した答案画像と注釈は両端末で生きている", () => {
    expect(rivalObservation.studentAnswerImagesB).toEqual([
      {
        id: "image-x",
        examStudentId: "exam-student-y",
        content: "answers/x.png",
      },
    ])
    expect(rivalObservation.annotationsB).toEqual([
      { id: "annotation-x", questionScoreId: "question-score-x" },
    ])
    expect(rivalObservation.studentAnswerImagesA).toEqual(
      rivalObservation.studentAnswerImagesB
    )
    expect(rivalObservation.annotationsA).toEqual(rivalObservation.annotationsB)
  })
})
