/**
 * 試験アーカイブ バージョン変換チェーンのユニットテスト
 *
 * 歴史バージョンの実アーカイブ形状（git履歴の dataCollector から復元）を
 * チェーンに通し、最新形式へ正しく変換されることを検証する。
 * 各形状の出典コミット: 1.0.0=664bf11d, 1.15.0=b269bcad
 */

import { describe, expect, test } from "vitest"

import {
  detectExamArchiveVersion,
  transformExamArchiveToLatest,
} from "../../../electron-src/lib/import/transformers"
import type { ExamArchiveData } from "../../../src/types/examArchive.types"

const TIMESTAMP = "2026-01-01T00:00:00.000Z"

function createManifest(version: string): Record<string, unknown> {
  return {
    version,
    schemaVersion: "unknown",
    appVersion: "test",
    exportedAt: TIMESTAMP,
    examId: "exam-1",
    examName: "テスト試験",
    counts: {
      students: 1,
      classrooms: 1,
      users: 1,
      pages: 1,
      regions: 1,
      scores: 1,
      annotations: 0,
      subtotalGroups: 0,
      masterImages: 0,
      answerSheetImages: 0,
    },
  }
}

/** v1.0.0 (アプリ v0.2.x) 実形状: project系キー + pageImages + studentId */
function createV1_0_0_ArchiveData(): ExamArchiveData {
  const raw = {
    manifest: createManifest("1.0.0"),
    examData: {
      project: {
        id: "exam-1",
        examName: "旧試験",
        examDate: null,
        subject: "数学",
        description: null,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      projectPages: [
        {
          id: "page-1",
          projectId: "exam-1",
          pageNumber: 1,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      cropRegions: [
        {
          id: "region-1",
          projectPageId: "page-1",
          label: "問1",
          type: "answer",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          points: null,
          orderIndex: 0,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      pageImages: [
        {
          id: "img-1",
          projectPageId: "page-1",
          studentId: null,
          imagePath: "master-images/1.png",
          imageType: "MODEL_ANSWER",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
        {
          id: "img-2",
          projectPageId: "page-1",
          studentId: "student-1",
          imagePath: "answer-sheets/student-1/1.png",
          imageType: "STUDENT_ANSWER",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      projectStudents: [
        {
          id: "examstudent-1",
          projectId: "exam-1",
          studentId: "student-1",
          status: "PARTICIPATING",
          customOrder: 0,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      userProjects: [
        {
          id: "userexam-1",
          userId: "user-1",
          projectId: "exam-1",
          role: "OWNER",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      projectSubtotalGroups: [],
    },
    studentsData: {
      students: [
        {
          id: "student-1",
          studentId: "1001",
          lastName: "山田",
          firstName: "太郎",
          lastNameKana: "ヤマダ",
          firstNameKana: "タロウ",
          enrollmentYear: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    },
    classesData: {
      classes: [
        {
          id: "classroom-1",
          name: "1年A組",
          classCode: "1A",
          grade: 1,
          description: null,
          isVisible: true,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      memberships: [
        {
          id: "membership-1",
          studentId: "student-1",
          classId: "classroom-1",
          startDate: TIMESTAMP,
          endDate: null,
          attendanceNumber: 1,
          notes: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    },
    usersData: {
      users: [
        {
          id: "user-1",
          name: "先生",
          email: "teacher@example.com",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    },
    subtotalsData: { subtotalGroups: [], subtotals: [] },
    scoresData: {
      questionScores: [
        {
          id: "score-1",
          cropRegionId: "region-1",
          studentId: "student-1",
          partialScore: null,
          status: "final",
          scoredByUserId: "user-1",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      drawingAnnotations: [],
    },
  }
  return raw as unknown as ExamArchiveData
}

/** v1.15.0 (アプリ v0.14.x) 実形状: examClasses キー + classId + teacherStat */
function createV1_15_0_ArchiveData(): ExamArchiveData {
  const raw = {
    manifest: createManifest("1.15.0"),
    examData: {
      exam: {
        id: "exam-1",
        examName: "学級統計試験",
        examDate: null,
        description: null,
        markerCorrectionEnabled: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      examPages: [
        {
          id: "page-1",
          examId: "exam-1",
          pageNumber: 1,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      cropRegions: [],
      pageImages: [],
      masterImages: [],
      studentAnswerImages: [],
      examStudents: [
        {
          id: "examstudent-1",
          examId: "exam-1",
          studentId: "student-1",
          status: "PARTICIPATING",
          customOrder: 0,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      userExams: [],
      examSubtotalGroups: [
        {
          id: "examsubtotalgroup-1",
          examId: "exam-1",
          subtotalGroupId: "subtotalgroup-1",
          selectedForTable: true,
          selectedForBoxPlot: false,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      examClasses: [
        {
          id: "examclassroom-1",
          examId: "exam-1",
          classId: "classroom-1",
          administered: true,
          teacherStat: true,
          studentReport: true,
          order: 0,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      examMarkingFormats: [],
      examExportSettings: null,
      cropRegionMarkingOverrides: [],
      omrConfigs: [],
      omrChoiceOptions: [],
      omrDigitBoxes: [],
      compoundAnswers: [],
      compoundAnswerMembers: [],
      compoundAnswerScores: [],
    },
    studentsData: {
      students: [
        {
          id: "student-1",
          studentNumber: "1001",
          lastName: "山田",
          firstName: "太郎",
          lastNameKana: "ヤマダ",
          firstNameKana: "タロウ",
          enrollmentYear: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    },
    classesData: {
      classes: [
        {
          id: "classroom-1",
          name: "1年A組",
          classCode: "1A",
          grade: 1,
          description: null,
          isVisible: true,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      memberships: [
        {
          id: "membership-1",
          studentId: "student-1",
          classId: "classroom-1",
          startDate: TIMESTAMP,
          endDate: null,
          attendanceNumber: 1,
          notes: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    },
    usersData: { users: [] },
    subtotalsData: {
      subtotalGroups: [
        {
          id: "subtotalgroup-1",
          name: "小計A",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      subtotals: [],
    },
    scoresData: {
      questionScores: [],
      drawingAnnotations: [],
      scoreDecisions: [],
      returnSnapshots: [],
    },
    tagsData: { tags: [], tagSubtotalGroups: [], examTags: [] },
    deletedRecordsData: { deletedRecords: [] },
  }
  return raw as unknown as ExamArchiveData
}

/** 現行 (v1.17.0) 最小形状 */
function createCurrentArchiveData(): ExamArchiveData {
  const raw = {
    manifest: createManifest("1.17.0"),
    examData: {
      exam: {
        id: "exam-1",
        examName: "現行試験",
        examDate: null,
        description: null,
        markerCorrectionEnabled: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      examPages: [],
      cropRegions: [],
      pageImages: [],
      masterImages: [],
      studentAnswerImages: [],
      examStudents: [],
      userExams: [],
      examSubtotalGroups: [],
      examClassrooms: [],
      examMarkingFormats: [],
      examExportSettings: null,
      cropRegionMarkingOverrides: [],
    },
    studentsData: { students: [] },
    classesData: { classrooms: [], memberships: [] },
    usersData: { users: [] },
    subtotalsData: { subtotalGroups: [], subtotals: [] },
    scoresData: {
      questionScores: [],
      drawingAnnotations: [],
      scoreDecisions: [],
      returnSnapshots: [],
    },
    tagsData: { tags: [], tagSubtotalGroups: [], examTags: [] },
    deletedRecordsData: { deletedRecords: [] },
  }
  return raw as unknown as ExamArchiveData
}

describe("transformExamArchiveToLatest", () => {
  test("v1.0.0 実形状（project系キー）が全17変換を経て最新形式になる", () => {
    const result = transformExamArchiveToLatest(createV1_0_0_ArchiveData())

    expect(result.originalVersion).toBe("1.0.0")
    expect(result.finalVersion).toBe("1.17.0")
    expect(result.appliedTransformations).toHaveLength(17)
    expect(result.data.manifest.version).toBe("1.17.0")

    const examData = result.data.examData
    const examDataRecord = examData as unknown as Record<string, unknown>

    // project → exam キーリネーム
    expect(examData.exam.id).toBe("exam-1")
    expect(examDataRecord.project).toBeUndefined()
    expect(examData.examPages).toHaveLength(1)
    expect(examDataRecord.projectPages).toBeUndefined()

    // pageImages → MasterImage/StudentAnswerImage 分離（projectPageId を継承）
    expect(examData.masterImages).toEqual([
      expect.objectContaining({ id: "img-1", examPageId: "page-1" }),
    ])
    expect(examData.studentAnswerImages).toEqual([
      expect.objectContaining({
        id: "img-2",
        examPageId: "page-1",
        studentId: "student-1",
      }),
    ])

    // cropRegions: projectPageId → examPageId
    expect(examData.cropRegions[0].examPageId).toBe("page-1")

    // projectStudents → examStudents + status 小文字化
    expect(examData.examStudents).toEqual([
      expect.objectContaining({ id: "examstudent-1", status: "participating" }),
    ])

    // userProjects → userExams + invitedAt/invitedBy 補完 + projectId → examId
    expect(examData.userExams).toEqual([
      expect.objectContaining({
        id: "userexam-1",
        examId: "exam-1",
        role: "OWNER",
        invitedAt: TIMESTAMP,
        invitedBy: null,
      }),
    ])

    // ExamClassroom は 1.1.0 追加 → 空配列で初期化
    expect(examData.examClassrooms).toEqual([])

    // Student.studentId → studentNumber
    expect(result.data.studentsData.students[0].studentNumber).toBe("1001")

    // classes.json: classes → classrooms, classId → classroomId, classCode → classroomCode
    expect(result.data.classesData.classrooms[0]).toMatchObject({
      id: "classroom-1",
      classroomCode: "1A",
    })
    expect(result.data.classesData.memberships[0].classroomId).toBe(
      "classroom-1"
    )

    // final 採点行 → ScoreDecision 導出、scoredByUserId → userId
    expect(result.data.scoresData.scoreDecisions).toHaveLength(1)
    expect(result.data.scoresData.scoreDecisions![0]).toMatchObject({
      studentId: "student-1",
      cropRegionId: "region-1",
      verdict: "correct",
      decidedByUserId: "user-1",
    })
    expect(
      result.data.scoresData.questionScores.filter(
        (questionScore) =>
          questionScore.status === "final" ||
          questionScore.status === "proposed"
      )
    ).toEqual([])

    // 後発バージョンの初期化
    expect(result.data.scoresData.returnSnapshots).toEqual([])
    expect(result.data.tagsData).toBeDefined()
    expect(result.data.deletedRecordsData).toEqual({ deletedRecords: [] })
    expect(examData.exam.markerCorrectionEnabled).toBe(false)
  })

  test("v1.15.0 実形状（examClasses/teacherStat）が最新形式になる", () => {
    const result = transformExamArchiveToLatest(createV1_15_0_ArchiveData())

    expect(result.originalVersion).toBe("1.15.0")
    expect(result.appliedTransformations).toEqual([
      { from: "1.15.0", to: "1.16.0" },
      { from: "1.16.0", to: "1.17.0" },
    ])

    const examData = result.data.examData
    const examDataRecord = examData as unknown as Record<string, unknown>

    // examClasses → examClassrooms（本バグ #912 の回帰確認）
    expect(examDataRecord.examClasses).toBeUndefined()
    expect(examData.examClassrooms).toHaveLength(1)
    const examClassroom = examData.examClassrooms[0]
    expect(examClassroom.classroomId).toBe("classroom-1")
    expect(examClassroom.teacherStatistics).toBe(true)
    expect(examClassroom.studentReport).toBe(true)
    expect("teacherStat" in examClassroom).toBe(false)
    expect(examClassroom.order).toBe(0)

    // classes.json 側のキーも正規化される
    expect(result.data.classesData.classrooms).toHaveLength(1)
    expect(result.data.classesData.memberships[0].classroomId).toBe(
      "classroom-1"
    )

    // 大文字 status の小文字化
    expect(examData.examStudents[0].status).toBe("participating")

    // 既存の selectedFor* は保持
    expect(examData.examSubtotalGroups[0].selectedForTable).toBe(true)
  })

  test("v1.14.0 相当（statistics フラグ）は teacherStatistics/studentReport へ移行される", () => {
    const data = createV1_15_0_ArchiveData()
    const examDataRecord = data.examData as unknown as Record<string, unknown>
    examDataRecord.examClasses = [
      {
        id: "examclassroom-1",
        examId: "exam-1",
        classId: "classroom-1",
        administered: false,
        statistics: true,
        order: 0,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]
    const examSubtotalGroups = examDataRecord.examSubtotalGroups as Record<
      string,
      unknown
    >[]
    delete examSubtotalGroups[0].selectedForTable
    delete examSubtotalGroups[0].selectedForBoxPlot
    data.manifest.version = "1.14.0"

    const result = transformExamArchiveToLatest(data)

    const examClassroom = result.data.examData.examClassrooms[0]
    expect(examClassroom.teacherStatistics).toBe(true) // statistics から
    expect(examClassroom.studentReport).toBe(false) // administered から
    expect("statistics" in examClassroom).toBe(false)
    expect(result.data.examData.examSubtotalGroups[0].selectedForTable).toBe(
      false
    )
    expect(result.data.examData.examSubtotalGroups[0].selectedForBoxPlot).toBe(
      false
    )
  })

  test("形状ベース下方補正: manifest が現行版でも examClasses があれば変換される（クラッシュ回帰）", () => {
    const data = createV1_15_0_ArchiveData()
    data.manifest.version = "1.17.0" // 実形状より新しい版数を名乗る

    const detection = detectExamArchiveVersion(data)
    expect(detection.version).toBe("1.15.0")
    expect(detection.corrections.length).toBeGreaterThan(0)

    const result = transformExamArchiveToLatest(data)
    // examClassrooms が必ず配列になる（"examClassrooms is not iterable" の回帰）
    expect(Array.isArray(result.data.examData.examClassrooms)).toBe(true)
    expect(result.data.examData.examClassrooms).toHaveLength(1)
    expect(result.warnings.some((warning) => warning.includes("v1.15.0"))).toBe(
      true
    )
  })

  test("形状フロアは現行キーが併存する場合は発火しない（残骸キーによる過剰引き下げ＝データ破壊の防止）", () => {
    const data = createCurrentArchiveData()
    const examDataRecord = data.examData as unknown as Record<string, unknown>
    // リファクタ途中ビルドが残した旧キーの残骸を模す（現行キーは全て揃っている）
    examDataRecord.projectStudents = []
    // 過剰引き下げで破壊されうる現行データ（タグ・OMR位置）を持たせる
    data.tagsData = {
      tags: [
        {
          id: "tag-1",
          name: "数学",
          order: 2,
          color: "#ff0000",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      tagSubtotalGroups: [],
      examTags: [{ id: "examtag-1", examId: "exam-1", tagId: "tag-1" }],
    } as unknown as ExamArchiveData["tagsData"]
    examDataRecord.omrChoiceOptions = [
      {
        id: "omrchoiceoption-1",
        omrConfigId: "omrconfig-1",
        label: "ア",
        shape: "circle",
        normalizedCx: 0.5,
        normalizedCy: 0.5,
        normalizedWidth: 0.1,
        normalizedHeight: 0.1,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]

    const detection = detectExamArchiveVersion(data)
    expect(detection.version).toBe("1.17.0")
    expect(detection.corrections).toEqual([])

    const result = transformExamArchiveToLatest(data)
    expect(result.appliedTransformations).toEqual([])
    // タグ・OMR位置が無傷で残る
    expect(result.data.tagsData!.tags).toHaveLength(1)
    expect(result.data.tagsData!.tags[0].order).toBe(2)
    expect(result.data.tagsData!.examTags).toHaveLength(1)
    expect(result.data.examData.omrChoiceOptions![0].normalizedCx).toBe(0.5)
  })

  test("examClassrooms キーだがレコードが classId のままの部分リネームアーカイブも正規化される", () => {
    const data = createV1_15_0_ArchiveData()
    const examDataRecord = data.examData as unknown as Record<string, unknown>
    // 現行キー配下に旧フィールドのレコード、という中間状態を模す
    examDataRecord.examClassrooms = examDataRecord.examClasses
    delete examDataRecord.examClasses
    data.manifest.version = "1.17.0"

    const detection = detectExamArchiveVersion(data)
    expect(detection.version).toBe("1.15.0")

    const result = transformExamArchiveToLatest(data)
    const examClassroom = result.data.examData.examClassrooms[0]
    expect(examClassroom.classroomId).toBe("classroom-1")
    expect(examClassroom.teacherStatistics).toBe(true)
    expect("classId" in examClassroom).toBe(false)
  })

  test("未分離 pageImages のアーカイブが新しい版数を名乗っても分離が実行される", () => {
    const data = createV1_0_0_ArchiveData()
    data.manifest.version = "1.5.0" // 実形状（1.0.0相当）より新しい版数を名乗る

    const detection = detectExamArchiveVersion(data)
    expect(detection.version).toBe("1.1.0")

    const result = transformExamArchiveToLatest(data)
    expect(result.data.examData.masterImages).toEqual([
      expect.objectContaining({ id: "img-1", examPageId: "page-1" }),
    ])
    expect(result.data.examData.studentAnswerImages).toEqual([
      expect.objectContaining({ id: "img-2", studentId: "student-1" }),
    ])
    expect(result.data.studentsData.students[0].studentNumber).toBe("1001")
  })

  test("studentReport 欠落レコードは administered から補完される（版数が新しくても）", () => {
    const data = createCurrentArchiveData()
    const examDataRecord = data.examData as unknown as Record<string, unknown>
    examDataRecord.examClassrooms = [
      {
        id: "examclassroom-1",
        examId: "exam-1",
        classroomId: "classroom-1",
        administered: true,
        order: 0,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]
    data.manifest.version = "1.16.0"

    const detection = detectExamArchiveVersion(data)
    expect(detection.version).toBe("1.14.0")

    const result = transformExamArchiveToLatest(data)
    const examClassroom = result.data.examData.examClassrooms[0]
    expect(examClassroom.studentReport).toBe(true) // administered から
    expect(examClassroom.teacherStatistics).toBe(false)
  })

  test("現行形式は無変換で素通しされる", () => {
    const data = createCurrentArchiveData()
    const result = transformExamArchiveToLatest(data)

    expect(result.originalVersion).toBe("1.17.0")
    expect(result.appliedTransformations).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.data).toBe(data)
  })

  test("不正なバージョン文字列は例外を投げる", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "invalid"
    expect(() => transformExamArchiveToLatest(data)).toThrow(
      /Unknown exam archive version/
    )
  })

  test("変換は冪等（2回適用しても同一結果）", () => {
    const once = transformExamArchiveToLatest(createV1_15_0_ArchiveData())
    const twice = transformExamArchiveToLatest(once.data)
    expect(twice.appliedTransformations).toEqual([])
    expect(twice.data).toEqual(once.data)
  })
})
