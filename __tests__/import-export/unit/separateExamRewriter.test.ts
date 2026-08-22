/**
 * 「別で追加する」の id 振り直し（separateExamRewriter）のユニットテスト
 *
 * 見るのは2つ。
 *
 * 1. **正しさ** —— 試験にぶら下がる id は全て新しくなり、参照している列も一緒に付け替わる。
 *    試験をまたいで共有される実体（生徒・学級・小計・利用者）は動かさない。
 *    文字列の中に JSON として畳まれた id（ReturnSnapshot.scoresJson）も届く。
 * 2. **終わること** —— id ごとに全文を走査していた頃は 200名規模で固まっていた。
 *    走査は1回で済むはずなので、その規模でも現実的な時間で終わる。
 */

import { describe, expect, test } from "vitest"

import { rewriteAsSeparateExam } from "../../../electron-src/lib/import/merge/separateExamRewriter"
import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createArchiveUsersData,
  createExtractedArchiveData,
  generateId,
} from "../../helpers/testDataFactory"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("rewriteAsSeparateExam", () => {
  test("試験にぶら下がる id は新しくなり、参照している列も一緒に付け替わる", () => {
    const examData = createArchiveExamData({ pageCount: 1 })
    const examId = examData.exam.id
    const pageId = examData.examPages[0].id
    const regionId = examData.cropRegions[0].id
    const studentId = generateId()
    const graderId = generateId()
    const examStudentId = generateId()
    examData.examStudents = [
      {
        id: examStudentId,
        examId,
        studentId,
        status: "participating",
        customOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData([{ id: studentId }]),
      classesData: createArchiveClassesData(),
      usersData: createArchiveUsersData([{ id: graderId }]),
      subtotalsData: createArchiveSubtotalsData(),
      scoresData: createArchiveScoresData([
        {
          cropRegionId: regionId,
          examStudentId,
          userId: graderId,
        },
      ]),
    })

    const rewritten = rewriteAsSeparateExam(data)

    // 試験にぶら下がる id は全て別の uuid になる
    expect(rewritten.examData.exam.id).not.toBe(examId)
    expect(rewritten.examData.exam.id).toMatch(UUID_PATTERN)
    expect(rewritten.examData.examPages[0].id).not.toBe(pageId)
    expect(rewritten.examData.cropRegions[0].id).not.toBe(regionId)

    // 参照している列も同じ新しい id を指す
    expect(rewritten.examData.examPages[0].examId).toBe(
      rewritten.examData.exam.id
    )
    expect(rewritten.examData.cropRegions[0].examPageId).toBe(
      rewritten.examData.examPages[0].id
    )
    expect(rewritten.scoresData.questionScores[0].cropRegionId).toBe(
      rewritten.examData.cropRegions[0].id
    )
    expect(rewritten.scoresData.questionScores[0].examStudentId).toBe(
      rewritten.examData.examStudents[0].id
    )

    // 試験をまたいで共有される実体は動かさない
    expect(rewritten.examData.examStudents[0].studentId).toBe(studentId)
    expect(rewritten.studentsData.students[0].id).toBe(studentId)
    expect(rewritten.usersData.users[0].id).toBe(graderId)
    expect(rewritten.scoresData.questionScores[0].userId).toBe(graderId)
  })

  test("文字列の中に JSON として畳まれた id も付け替わる", () => {
    const examData = createArchiveExamData({ pageCount: 1 })
    const regionId = examData.cropRegions[0].id
    const examStudentId = generateId()
    examData.examStudents = [
      {
        id: examStudentId,
        examId: examData.exam.id,
        studentId: generateId(),
        status: "participating",
        customOrder: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const data = createExtractedArchiveData({ examData })
    data.scoresData.returnSnapshots = [
      {
        id: generateId(),
        examStudentId,
        scoresJson: JSON.stringify({ scores: [{ cropRegionId: regionId }] }),
        totalScore: null,
        capturedByUserId: null,
        capturedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const rewritten = rewriteAsSeparateExam(data)
    const newRegionId = rewritten.examData.cropRegions[0].id

    expect(rewritten.scoresData.returnSnapshots?.[0].scoresJson).toBe(
      JSON.stringify({ scores: [{ cropRegionId: newRegionId }] })
    )
  })

  test("id の一部だけが書かれた文字列は書き換えない", () => {
    const examData = createArchiveExamData({ pageCount: 1 })
    // 採点枠のラベルに、たまたま id の一部と同じ並びが入っている状況を作る
    const regionId = examData.cropRegions[0].id
    examData.cropRegions[0].label = `問1（${regionId.slice(0, 8)}）`

    const rewritten = rewriteAsSeparateExam(
      createExtractedArchiveData({ examData })
    )

    expect(rewritten.examData.cropRegions[0].label).toBe(
      `問1（${regionId.slice(0, 8)}）`
    )
  })

  test("200名規模のアーカイブでも現実的な時間で終わる", () => {
    // 200名 × 30設問 ＝ 6,000 の採点行。id は行ごとに1つ以上あるので、
    // 全文の走査を id の数だけ繰り返す実装ではここで止まる
    const examData = createArchiveExamData({
      pageCount: 3,
      cropRegionsPerPage: 10,
    })
    const examId = examData.exam.id
    const studentIds = Array.from({ length: 200 }, () => generateId())
    examData.examStudents = studentIds.map((studentId, index) => ({
      id: generateId(),
      examId,
      studentId,
      status: "participating",
      customOrder: index + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    const graderId = generateId()
    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData(
        studentIds.map((studentId) => ({ id: studentId }))
      ),
      scoresData: createArchiveScoresData(
        examData.examStudents.flatMap((examStudent) =>
          examData.cropRegions.map((cropRegion) => ({
            cropRegionId: cropRegion.id,
            examStudentId: examStudent.id,
            userId: graderId,
          }))
        )
      ),
    })

    const startedAt = Date.now()
    const rewritten = rewriteAsSeparateExam(data)
    const elapsedMs = Date.now() - startedAt

    expect(rewritten.scoresData.questionScores).toHaveLength(6000)
    // 1回の走査なら数十ミリ秒で終わる。id ごとに全文を走査していた頃は
    // この規模で数秒かかっていた（実測 4.6 秒）
    expect(elapsedMs).toBeLessThan(1000)
  })
})
