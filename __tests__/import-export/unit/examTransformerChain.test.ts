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
      omrConfigs: [],
      omrChoiceOptions: [],
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

/** 現行 (v1.23.0) 最小形状 */
function createCurrentArchiveData(): ExamArchiveData {
  const raw = {
    manifest: createManifest("1.23.0"),
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
      studentAnswerImages: [],
      examStudents: [],
      userExams: [],
      examSubtotalGroups: [],
      examClassrooms: [],
      examMarkingFormats: [],
      examExportSettings: null,
    },
    studentsData: { students: [] },
    classesData: { classrooms: [], memberships: [] },
    usersData: { users: [] },
    subtotalsData: { subtotalGroups: [], subtotals: [] },
    scoresData: {
      questionScores: [],
      drawingAnnotations: [],
      scoreDecisions: [],
      cropRegionAssignments: [],
      returnSnapshots: [],
    },
    tagsData: { tags: [], tagSubtotalGroups: [], examTags: [] },
  }
  return raw as unknown as ExamArchiveData
}

/**
 * 旧形状（1.23.0 未満）の行を差し込む。`ExamArchiveData` は最新版の形しか表せないため、
 * 旧キーの行は型の外から入れる（`Object.assign` で足りるので `as` は使わない）。
 */
const putLegacyRows = (
  target: object,
  rows: Record<string, unknown[]>
): void => {
  Object.assign(target, rows)
}

describe("transformExamArchiveToLatest", () => {
  test("v1.0.0 実形状（project系キー）が全23変換を経て最新形式になる", () => {
    const result = transformExamArchiveToLatest(createV1_0_0_ArchiveData())

    expect(result.originalVersion).toBe("1.0.0")
    expect(result.finalVersion).toBe("1.23.0")
    expect(result.appliedTransformations).toHaveLength(23)
    expect(result.data.manifest.version).toBe("1.23.0")

    const examData = result.data.examData
    const examDataRecord = examData as unknown as Record<string, unknown>

    // project → exam キーリネーム
    expect(examData.exam.id).toBe("exam-1")
    expect(examDataRecord.project).toBeUndefined()
    expect(examData.examPages).toHaveLength(1)
    expect(examDataRecord.projectPages).toBeUndefined()

    // pageImages → 模範解答/答案 分離（projectPageId を継承）のうち、
    // 模範解答は最終的にページへ畳まれる
    expect(examData.examPages[0]).toMatchObject({
      id: "page-1",
      imagePath: "master-images/1.png",
      pageSize: "A4",
    })
    expect(examData.studentAnswerImages).toEqual([
      expect.objectContaining({
        id: "img-2",
        examPageId: "page-1",
        examStudentId: "examstudent-1",
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
      examStudentId: "examstudent-1",
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
    // v1.9.0 で追加された削除記録は v1.19.0 で廃止され読み捨てられる
    expect(result.data.deletedRecordsData).toBeUndefined()
    expect(examData.exam.markerCorrectionEnabled).toBe(false)
  })

  test("v1.15.0 実形状（examClasses/teacherStat）が最新形式になる", () => {
    const result = transformExamArchiveToLatest(createV1_15_0_ArchiveData())

    expect(result.originalVersion).toBe("1.15.0")
    expect(result.appliedTransformations).toEqual([
      { from: "1.15.0", to: "1.16.0" },
      { from: "1.16.0", to: "1.17.0" },
      { from: "1.17.0", to: "1.18.0" },
      { from: "1.18.0", to: "1.19.0" },
      { from: "1.19.0", to: "1.20.0" },
      { from: "1.20.0", to: "1.21.0" },
      { from: "1.21.0", to: "1.22.0" },
      { from: "1.22.0", to: "1.23.0" },
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
    data.manifest.version = "1.19.0" // 実形状より新しい版数を名乗る

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
    expect(detection.version).toBe("1.23.0")
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
    data.manifest.version = "1.19.0"

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
    expect(result.data.examData.examPages[0]).toMatchObject({
      id: "page-1",
      imagePath: "master-images/1.png",
    })
    expect(result.data.examData.studentAnswerImages).toEqual([
      expect.objectContaining({ id: "img-2", examStudentId: "examstudent-1" }),
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

  test("v1.17.0 の設問別マーク上書き（廃止済み）は読み捨てられ、件数が警告に出る", () => {
    const data = createCurrentArchiveData()
    const examDataRecord = data.examData as unknown as Record<string, unknown>
    // v1.17.0 までの実形状: 廃止前の cropRegionMarkingOverrides を持つ
    examDataRecord.cropRegionMarkingOverrides = [
      {
        id: "cropregionmarkingoverride-1",
        cropRegionId: "region-1",
        markType: "correct",
        symbol: "◎",
        color: "#0000ff",
        visible: true,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]
    data.manifest.version = "1.17.0"

    const result = transformExamArchiveToLatest(data)

    expect(result.appliedTransformations).toEqual([
      { from: "1.17.0", to: "1.18.0" },
      { from: "1.18.0", to: "1.19.0" },
      { from: "1.19.0", to: "1.20.0" },
      { from: "1.20.0", to: "1.21.0" },
      { from: "1.21.0", to: "1.22.0" },
      { from: "1.22.0", to: "1.23.0" },
    ])
    // キーごと落ちる（取り込み先が存在しないため）
    const transformedExamData = result.data.examData as unknown as Record<
      string,
      unknown
    >
    expect("cropRegionMarkingOverrides" in transformedExamData).toBe(false)
    // 読み飛ばした件数が利用者に伝わる
    expect(
      result.warnings.some((warning) => warning.includes("1件を読み飛ばし"))
    ).toBe(true)
  })

  test("廃止済みキーを持たない v1.17.0 アーカイブは警告なしで 1.23.0 になる", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "1.17.0"

    const result = transformExamArchiveToLatest(data)

    expect(result.finalVersion).toBe("1.23.0")
    expect(result.warnings).toEqual([])
  })

  test("v1.18.0 の削除記録（廃止済み）は読み捨てられ、件数が警告に出る", () => {
    const data = createCurrentArchiveData()
    const archiveRecord = data as unknown as Record<string, unknown>
    // v1.18.0 までの実形状: 廃止前の deletedRecordsData を持つ
    archiveRecord.deletedRecordsData = {
      deletedRecords: [
        {
          id: "deletedrecord-1",
          tableName: "DrawingAnnotation",
          recordId: "drawingannotation-1",
          deletedAt: TIMESTAMP,
          userId: null,
          examId: "exam-1",
        },
      ],
    }
    data.manifest.version = "1.18.0"

    const result = transformExamArchiveToLatest(data)

    expect(result.appliedTransformations).toEqual([
      { from: "1.18.0", to: "1.19.0" },
      { from: "1.19.0", to: "1.20.0" },
      { from: "1.20.0", to: "1.21.0" },
      { from: "1.21.0", to: "1.22.0" },
      { from: "1.22.0", to: "1.23.0" },
    ])
    // キーごと落ちる（アーカイブは正本であり復活防止をしないため）
    const transformedRecord = result.data as unknown as Record<string, unknown>
    expect("deletedRecordsData" in transformedRecord).toBe(false)
    // 読み飛ばした件数が利用者に伝わる
    expect(
      result.warnings.some((warning) => warning.includes("1件を読み飛ばし"))
    ).toBe(true)
  })

  test("1.19.0 → 1.20.0: 採点担当は空配列で補完される（担当0人＝全員担当）", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "1.19.0"
    delete data.scoresData.cropRegionAssignments

    const result = transformExamArchiveToLatest(data)

    expect(result.appliedTransformations).toEqual([
      { from: "1.19.0", to: "1.20.0" },
      { from: "1.20.0", to: "1.21.0" },
      { from: "1.21.0", to: "1.22.0" },
      { from: "1.22.0", to: "1.23.0" },
    ])
    expect(result.data.scoresData.cropRegionAssignments).toEqual([])
  })

  test("1.20.0 → 1.21.0: 採点層が受験者（examStudentId）へ付け替わる", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "1.20.0"
    putLegacyRows(data.examData, {
      examStudents: [
        {
          id: "examstudent-1",
          examId: "exam-1",
          studentId: "student-1",
          status: "participating",
          customOrder: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      studentAnswerImages: [
        {
          id: "image-1",
          examPageId: "page-1",
          studentId: "student-1",
          imagePath: "answer-sheets/1.png",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })
    putLegacyRows(data.scoresData, {
      questionScores: [
        {
          id: "score-1",
          cropRegionId: "region-1",
          studentId: "student-1",
          partialScore: null,
          status: "correct",
          userId: "user-1",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      returnSnapshots: [
        {
          id: "snapshot-1",
          examId: "exam-1",
          studentId: "student-1",
          scoresJson: "{}",
          totalScore: null,
          capturedByUserId: null,
          capturedAt: TIMESTAMP,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })

    const result = transformExamArchiveToLatest(data)

    expect(result.appliedTransformations).toEqual([
      { from: "1.20.0", to: "1.21.0" },
      { from: "1.21.0", to: "1.22.0" },
      { from: "1.22.0", to: "1.23.0" },
    ])
    expect(result.data.examData.studentAnswerImages).toEqual([
      expect.objectContaining({
        id: "image-1",
        examStudentId: "examstudent-1",
      }),
    ])
    expect(result.data.scoresData.questionScores).toEqual([
      expect.objectContaining({
        id: "score-1",
        examStudentId: "examstudent-1",
      }),
    ])
    // ReturnSnapshot の examId は ExamStudent から辿れるので落とす
    const snapshot = result.data.scoresData.returnSnapshots![0]
    expect(snapshot.examStudentId).toBe("examstudent-1")
    expect("examId" in snapshot).toBe(false)
  })

  test("1.20.0 → 1.21.0: 受験者に居ない生徒の採点は破棄され、件数が警告に出る", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "1.20.0"
    // examStudents は空 ＝ 受験者として登録されていない
    putLegacyRows(data.examData, { examStudents: [] })
    putLegacyRows(data.scoresData, {
      questionScores: [
        {
          id: "score-orphan",
          cropRegionId: "region-1",
          studentId: "student-orphan",
          partialScore: null,
          status: "correct",
          userId: "user-1",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      drawingAnnotations: [
        {
          id: "annot-orphan",
          questionScoreId: "score-orphan",
          type: "circle",
          x: 1,
          y: 1,
          color: "#ef4444",
          strokeWidth: 0.5,
          width: 0,
          height: 0,
          endX: 0,
          endY: 0,
          lineStyle: "solid",
          text: "",
          fontSize: 4,
          textBoxWidth: 0,
          textBoxHeight: 0,
          horizontalAlign: "left",
          verticalAlign: "top",
          anchorDirection: "top-left",
          displayX: 0,
          displayY: 0,
          isFavorite: false,
          userId: "user-1",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })

    const result = transformExamArchiveToLatest(data)

    expect(result.data.scoresData.questionScores).toEqual([])
    // 親を失った注釈も道連れ
    expect(result.data.scoresData.drawingAnnotations).toEqual([])
    expect(
      result.warnings.some((warning) => warning.includes("1 件を破棄"))
    ).toBe(true)
  })

  test("1.21.0 → 1.22.0: 出力設定のJSONが5つのセクションへ展開される", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "1.21.0"
    Object.assign(data.examData, {
      examExportSettings: {
        id: "settings-1",
        examId: "exam-1",
        settingsJson: JSON.stringify({
          scoringMarkConfig: {
            markPosition: "bottom-right",
            markSize: 80,
            // 小計・合計は後方互換キーからのフォールバック
            summaryScore: { position: "top-right", size: 26 },
            showMarkForStatus: { correct: false },
          },
          individualReportOptions: {
            showAverage: "class",
            showDeviation: false,
            showRank: true,
            rankType: "overall",
            graphOptions: { showOverallBoxPlot: true },
          },
        }),
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    })

    const result = transformExamArchiveToLatest(data)
    const examData = result.data.examData

    // 重ね描きのスタイルは4種。マークの anchor は position と同値
    const styles = examData.answerOverlayStyles ?? []
    expect(styles.map((style) => style.overlayKind).sort()).toEqual([
      "mark",
      "partial",
      "subtotal",
      "total",
    ])
    const markStyle = styles.find((style) => style.overlayKind === "mark")
    expect(markStyle).toMatchObject({
      position: "bottom-right",
      anchor: "bottom-right",
      size: 80,
    })
    // summaryScore からのフォールバック
    expect(
      styles.find((style) => style.overlayKind === "subtotal")
    ).toMatchObject({ position: "top-right", size: 26 })
    expect(styles.find((style) => style.overlayKind === "total")).toMatchObject(
      {
        position: "top-right",
        size: 26,
      }
    )

    // 採点状態ごとの可視性は7行。保存値が既定を上書きする
    const visibilities = examData.answerOverlayVisibilities ?? []
    expect(visibilities).toHaveLength(7)
    expect(
      visibilities.find((visibility) => visibility.status === "correct")
        ?.showMark
    ).toBe(false)

    // 統計は種別×母集団の8行へ展開される
    const statistics = examData.individualReportStatisticVisibilities ?? []
    expect(statistics).toHaveLength(8)
    const cell = (statisticKind: string, scope: string) =>
      statistics.find(
        (entry) =>
          entry.statisticKind === statisticKind && entry.scope === scope
      )?.shown
    expect(cell("average", "classroom")).toBe(true)
    expect(cell("average", "overall")).toBe(false)
    expect(cell("deviation", "overall")).toBe(false)
    expect(cell("rank", "classroom")).toBe(false)
    expect(cell("rank", "overall")).toBe(true)
    // 旧形式に無かったセルは false で始まる
    expect(cell("deviation", "classroom")).toBe(false)
    expect(cell("boxPlot", "classroom")).toBe(false)

    // グラフ設定はスキーマの列名で出す（旧キーを残すと取り込みが失敗する）
    expect(examData.individualReportGraphSettings).toMatchObject({
      showTotalScoreBoxPlot: true,
    })
    expect(
      Object.keys(examData.individualReportGraphSettings ?? {})
    ).not.toContain("showBoxPlot")

    // 旧キーは残さない
    expect(examData).not.toHaveProperty("examExportSettings")
  })

  test("1.22.0 → 1.23.0: 模範解答画像がページへ畳まれる", () => {
    const data = createCurrentArchiveData()
    data.manifest.version = "1.22.0"
    putLegacyRows(data.examData, {
      examPages: [
        {
          id: "page-1",
          examId: "exam-1",
          pageNumber: 1,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      masterImages: [
        {
          id: "image-1",
          examPageId: "page-1",
          imagePath: "exams/exam-1/master-images/1.png",
          pageSize: "B4",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })

    const result = transformExamArchiveToLatest(data)
    const examData = result.data.examData

    expect(examData.examPages[0]).toMatchObject({
      id: "page-1",
      imagePath: "exams/exam-1/master-images/1.png",
      pageSize: "B4",
    })
    // 畳んだ側のセクションは残さない
    expect(examData).not.toHaveProperty("masterImages")
    expect(result.warnings).toEqual([])
  })

  test("1.22.0 → 1.23.0: 模範解答の無いページは画像なしで残り、件数が警告に出る", () => {
    // 旧実装では「答案が残っているページの模範解答だけを削除する」ことができた。
    // ここでページを捨てると採点領域も答案も道連れになるので、消さずに引き継ぐ
    const data = createCurrentArchiveData()
    data.manifest.version = "1.22.0"
    putLegacyRows(data.examData, {
      examPages: [
        {
          id: "page-ghost",
          examId: "exam-1",
          pageNumber: 1,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      masterImages: [],
    })

    const result = transformExamArchiveToLatest(data)

    expect(result.data.examData.examPages).toHaveLength(1)
    expect(result.data.examData.examPages[0]).toMatchObject({
      id: "page-ghost",
      imagePath: null,
      pageSize: "A4",
    })
    expect(result.warnings.some((warning) => warning.includes("1件"))).toBe(
      true
    )
  })

  test("1.22.0 → 1.23.0: 再適用しても畳み終わった画像パスを消さない（冪等）", () => {
    // 形状フロアが版数を引き下げると、既に 1.23.0 の形をしたデータへこの変換器が
    // もう一度かかる。masterImages が無いからといってページの imagePath を
    // 無条件に上書きすると、取り込んだ試験の模範解答が全滅する
    const data = createCurrentArchiveData()
    data.manifest.version = "1.22.0"
    putLegacyRows(data.examData, {
      examPages: [
        {
          id: "page-1",
          examId: "exam-1",
          pageNumber: 1,
          imagePath: "exams/exam-1/master-images/1.png",
          pageSize: "B4",
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })

    const result = transformExamArchiveToLatest(data)

    expect(result.data.examData.examPages[0]).toMatchObject({
      id: "page-1",
      imagePath: "exams/exam-1/master-images/1.png",
      pageSize: "B4",
    })
    expect(result.warnings).toEqual([])
  })

  test("現行形式は無変換で素通しされる", () => {
    const data = createCurrentArchiveData()
    const result = transformExamArchiveToLatest(data)

    expect(result.originalVersion).toBe("1.23.0")
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
