/**
 * テスト実行中にデータを段階的に追加するヘルパー
 *
 * テストプロセスからPrismaClientを直接操作してデータを追加する。
 * Electronのメインプロセスは経由しない。
 */

import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"

import { createPrismaClientForPath } from "../../helpers/testPrismaClient"
import {
  computeRegionDefinitions,
  generateMasterAnswerImage,
  generateStudentAnswerImage,
  generateStudentScores,
} from "./generate-images"

// ---------------------------------------------------------------------------
// PrismaClient（テストプロセスから直接DB操作）
// ---------------------------------------------------------------------------
const TEST_DATA_DIR = path.join(__dirname, "../data")
const DB_PATH = path.join(TEST_DATA_DIR, "database.db")

let prisma: PrismaClient

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClientForPath(DB_PATH)
  }
  return prisma
}

export async function disconnectPrisma() {
  if (prisma) await prisma.$disconnect()
}

// ---------------------------------------------------------------------------
// 生徒名データ（40名）
// ---------------------------------------------------------------------------
export const STUDENT_DATA = [
  {
    lastName: "佐藤",
    firstName: "翔太",
    lastNameKana: "サトウ",
    firstNameKana: "ショウタ",
  },
  {
    lastName: "鈴木",
    firstName: "美咲",
    lastNameKana: "スズキ",
    firstNameKana: "ミサキ",
  },
  {
    lastName: "高橋",
    firstName: "大翔",
    lastNameKana: "タカハシ",
    firstNameKana: "ヒロト",
  },
  {
    lastName: "田中",
    firstName: "結衣",
    lastNameKana: "タナカ",
    firstNameKana: "ユイ",
  },
  {
    lastName: "伊藤",
    firstName: "蓮",
    lastNameKana: "イトウ",
    firstNameKana: "レン",
  },
  {
    lastName: "渡辺",
    firstName: "陽菜",
    lastNameKana: "ワタナベ",
    firstNameKana: "ヒナ",
  },
  {
    lastName: "山本",
    firstName: "悠真",
    lastNameKana: "ヤマモト",
    firstNameKana: "ユウマ",
  },
  {
    lastName: "中村",
    firstName: "さくら",
    lastNameKana: "ナカムラ",
    firstNameKana: "サクラ",
  },
  {
    lastName: "小林",
    firstName: "陸",
    lastNameKana: "コバヤシ",
    firstNameKana: "リク",
  },
  {
    lastName: "加藤",
    firstName: "葵",
    lastNameKana: "カトウ",
    firstNameKana: "アオイ",
  },
  {
    lastName: "吉田",
    firstName: "湊",
    lastNameKana: "ヨシダ",
    firstNameKana: "ミナト",
  },
  {
    lastName: "山田",
    firstName: "芽依",
    lastNameKana: "ヤマダ",
    firstNameKana: "メイ",
  },
  {
    lastName: "松本",
    firstName: "悠人",
    lastNameKana: "マツモト",
    firstNameKana: "ユウト",
  },
  {
    lastName: "井上",
    firstName: "凛",
    lastNameKana: "イノウエ",
    firstNameKana: "リン",
  },
  {
    lastName: "木村",
    firstName: "颯太",
    lastNameKana: "キムラ",
    firstNameKana: "ソウタ",
  },
  {
    lastName: "林",
    firstName: "莉子",
    lastNameKana: "ハヤシ",
    firstNameKana: "リコ",
  },
  {
    lastName: "斎藤",
    firstName: "朝陽",
    lastNameKana: "サイトウ",
    firstNameKana: "アサヒ",
  },
  {
    lastName: "清水",
    firstName: "楓",
    lastNameKana: "シミズ",
    firstNameKana: "カエデ",
  },
  {
    lastName: "山口",
    firstName: "悠斗",
    lastNameKana: "ヤマグチ",
    firstNameKana: "ユウト",
  },
  {
    lastName: "森",
    firstName: "彩花",
    lastNameKana: "モリ",
    firstNameKana: "アヤカ",
  },
  {
    lastName: "池田",
    firstName: "樹",
    lastNameKana: "イケダ",
    firstNameKana: "イツキ",
  },
  {
    lastName: "橋本",
    firstName: "詩織",
    lastNameKana: "ハシモト",
    firstNameKana: "シオリ",
  },
  {
    lastName: "阿部",
    firstName: "颯",
    lastNameKana: "アベ",
    firstNameKana: "ハヤテ",
  },
  {
    lastName: "石川",
    firstName: "花音",
    lastNameKana: "イシカワ",
    firstNameKana: "カノン",
  },
  {
    lastName: "前田",
    firstName: "蒼",
    lastNameKana: "マエダ",
    firstNameKana: "アオ",
  },
  {
    lastName: "藤田",
    firstName: "心春",
    lastNameKana: "フジタ",
    firstNameKana: "コハル",
  },
  {
    lastName: "岡田",
    firstName: "瑛太",
    lastNameKana: "オカダ",
    firstNameKana: "エイタ",
  },
  {
    lastName: "後藤",
    firstName: "杏",
    lastNameKana: "ゴトウ",
    firstNameKana: "アン",
  },
  {
    lastName: "長谷川",
    firstName: "奏太",
    lastNameKana: "ハセガワ",
    firstNameKana: "ソウタ",
  },
  {
    lastName: "村上",
    firstName: "紬",
    lastNameKana: "ムラカミ",
    firstNameKana: "ツムギ",
  },
  {
    lastName: "近藤",
    firstName: "陽翔",
    lastNameKana: "コンドウ",
    firstNameKana: "ハルト",
  },
  {
    lastName: "石井",
    firstName: "美月",
    lastNameKana: "イシイ",
    firstNameKana: "ミヅキ",
  },
  {
    lastName: "坂本",
    firstName: "律",
    lastNameKana: "サカモト",
    firstNameKana: "リツ",
  },
  {
    lastName: "遠藤",
    firstName: "花",
    lastNameKana: "エンドウ",
    firstNameKana: "ハナ",
  },
  {
    lastName: "青木",
    firstName: "太一",
    lastNameKana: "アオキ",
    firstNameKana: "タイチ",
  },
  {
    lastName: "藤井",
    firstName: "琴音",
    lastNameKana: "フジイ",
    firstNameKana: "コトネ",
  },
  {
    lastName: "西村",
    firstName: "海翔",
    lastNameKana: "ニシムラ",
    firstNameKana: "カイト",
  },
  {
    lastName: "福田",
    firstName: "柚希",
    lastNameKana: "フクダ",
    firstNameKana: "ユズキ",
  },
  {
    lastName: "太田",
    firstName: "暖",
    lastNameKana: "オオタ",
    firstNameKana: "ダン",
  },
  {
    lastName: "三浦",
    firstName: "七海",
    lastNameKana: "ミウラ",
    firstNameKana: "ナナミ",
  },
]

// ---------------------------------------------------------------------------
// 生徒40名をバルク追加
// ---------------------------------------------------------------------------
export async function seedStudents(): Promise<string[]> {
  const db = getPrisma()
  const ids: string[] = []
  for (let i = 0; i < STUDENT_DATA.length; i++) {
    const studentData = STUDENT_DATA[i]
    const student = await db.student.create({
      data: {
        id: randomUUID(),
        studentNumber: `S${String(i + 1).padStart(3, "0")}`,
        lastName: studentData.lastName,
        firstName: studentData.firstName,
        lastNameKana: studentData.lastNameKana,
        firstNameKana: studentData.firstNameKana,
        enrollmentYear: 2025,
      },
    })
    ids.push(student.id)
  }
  console.log(`  [SEED] 生徒 ${ids.length}名 追加`)
  return ids
}

// ---------------------------------------------------------------------------
// 学級2クラスを作成し生徒を割り当て
// ---------------------------------------------------------------------------
export async function seedClasses(
  studentIds: string[]
): Promise<{ classAId: string; classBId: string }> {
  const db = getPrisma()
  const classroomA = await db.classroom.create({
    data: { id: randomUUID(), name: "2年A組", grade: 2 },
  })
  const classroomB = await db.classroom.create({
    data: { id: randomUUID(), name: "2年B組", grade: 2 },
  })
  for (let i = 0; i < 20; i++) {
    await db.studentClassroomMembership.create({
      data: {
        id: randomUUID(),
        studentId: studentIds[i],
        classroomId: classroomA.id,
        attendanceNumber: i + 1,
      },
    })
  }
  for (let i = 20; i < 40; i++) {
    await db.studentClassroomMembership.create({
      data: {
        id: randomUUID(),
        studentId: studentIds[i],
        classroomId: classroomB.id,
        attendanceNumber: i - 19,
      },
    })
  }
  console.log(`  [SEED] 学級 2クラス 追加`)
  return { classAId: classroomA.id, classBId: classroomB.id }
}

// ---------------------------------------------------------------------------
// 小計グループ + タグ
// ---------------------------------------------------------------------------
export async function seedSubtotalAndTag(): Promise<{
  subtotalGroupId: string
  subtotalIds: string[]
}> {
  const db = getPrisma()
  const subtotalGroup = await db.subtotalGroup.create({
    data: { id: randomUUID(), name: "観点別評価" },
  })
  const subtotalNames = [
    "知識・技能",
    "思考・判断・表現",
    "主体的に学習に取り組む態度",
  ]
  const subtotalIds: string[] = []
  for (let i = 0; i < subtotalNames.length; i++) {
    const subtotal = await db.subtotal.create({
      data: {
        id: randomUUID(),
        name: subtotalNames[i],
        subtotalGroupId: subtotalGroup.id,
        order: i,
      },
    })
    subtotalIds.push(subtotal.id)
  }
  const tag = await db.tag.create({
    data: { id: randomUUID(), name: "数学" },
  })
  await db.tagSubtotalGroup.create({
    data: {
      id: randomUUID(),
      tagId: tag.id,
      subtotalGroupId: subtotalGroup.id,
    },
  })
  console.log(`  [SEED] 小計グループ: 観点別評価 (3項目)`)
  return { subtotalGroupId: subtotalGroup.id, subtotalIds }
}

// ---------------------------------------------------------------------------
// 試験 + 採点領域 + 受験生徒 + 答案画像 + 採点結果
// ---------------------------------------------------------------------------
export async function seedExamWithScoring(
  userId: string,
  studentIds: string[],
  classAId: string,
  classBId: string,
  subtotalGroupId: string,
  subtotalIds: string[],
  templatePath: string
): Promise<string> {
  const db = getPrisma()
  const REGION_DEFINITIONS = computeRegionDefinitions(templatePath)

  const examId = randomUUID()
  await db.exam.create({
    data: {
      id: examId,
      examName: "第２回定期テスト 中２数学",
      examDate: new Date("2025-10-15"),
      description: "一次関数・連立方程式",
    },
  })
  await db.userExam.create({
    data: { id: randomUUID(), userId, examId, role: "OWNER" },
  })
  for (const classroomId of [classAId, classBId]) {
    await db.examClassroom.create({
      data: {
        id: randomUUID(),
        examId,
        classroomId,
        administered: true,
        teacherStatistics: true,
        studentReport: true,
      },
    })
  }
  await db.examSubtotalGroup.create({
    data: { id: randomUUID(), examId, subtotalGroupId },
  })

  const examPage = await db.examPage.create({
    data: { id: randomUUID(), examId, pageNumber: 1 },
  })

  // マスター画像（プレースホルダー白PNG）
  const masterDir = path.join(TEST_DATA_DIR, "exams", examId, "master-images")
  fs.mkdirSync(masterDir, { recursive: true })
  const masterPath = path.join(masterDir, "master-page-1.png")
  await sharp({
    create: {
      width: 2024,
      height: 2866,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toFile(masterPath)

  const relMasterPath = path
    .relative(TEST_DATA_DIR, masterPath)
    .replace(/\\/g, "/")
  await db.masterImage.create({
    data: {
      id: randomUUID(),
      examPageId: examPage.id,
      imagePath: relMasterPath,
    },
  })

  // 採点領域
  const cropRegionIds: string[] = []
  for (const region of REGION_DEFINITIONS) {
    const cropRegion = await db.cropRegion.create({
      data: {
        id: randomUUID(),
        examPageId: examPage.id,
        label: region.label,
        type: "QUESTION_ANSWER",
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        points: region.points,
        orderIndex: region.orderIndex,
      },
    })
    cropRegionIds.push(cropRegion.id)

    // 大問番号に応じて3つの小計に振り分け
    // Q1-Q3: 知識・技能, Q4-Q5: 思考・判断・表現, Q6-Q7: 主体的に学習に取り組む態度
    const majorNum = parseInt(region.label.replace(/[^\d].*/, ""), 10) || 1
    const subtotalIndex = majorNum <= 3 ? 0 : majorNum <= 5 ? 1 : 2
    await db.cropSubtotal.create({
      data: {
        id: randomUUID(),
        cropRegionId: cropRegion.id,
        subtotalId: subtotalIds[subtotalIndex],
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    })
  }

  // 受験生徒 & 答案画像（手書き風解答付き）
  const answerDir = path.join(TEST_DATA_DIR, "exams", examId, "answer-sheets")
  fs.mkdirSync(answerDir, { recursive: true })

  // 先に採点結果を計算（答案画像の生成に使う）
  const allScores: { regionIndex: number; score: number; status: string }[][] =
    []
  for (let i = 0; i < studentIds.length; i++) {
    allScores.push(generateStudentScores(i, REGION_DEFINITIONS))
  }

  const examStudentIds: string[] = []
  for (let i = 0; i < studentIds.length; i++) {
    const studentId = studentIds[i]
    const examStudent = await db.examStudent.create({
      data: {
        id: randomUUID(),
        examId,
        studentId,
        status: "PARTICIPATING",
        customOrder: i + 1,
      },
    })
    examStudentIds.push(examStudent.id)
    // 手書き風の解答をオーバーレイした答案画像を生成
    await generateStudentAnswerImage(
      answerDir,
      i,
      studentId,
      masterDir,
      REGION_DEFINITIONS,
      allScores[i]
    )
    const answerPath = path.join(answerDir, `${studentId}_page1.png`)
    const relAnswerPath = path
      .relative(TEST_DATA_DIR, answerPath)
      .replace(/\\/g, "/")
    await db.studentAnswerImage.create({
      data: {
        id: randomUUID(),
        examPageId: examPage.id,
        examStudentId: examStudent.id,
        imagePath: relAnswerPath,
      },
    })
  }

  // 採点結果
  for (let i = 0; i < studentIds.length; i++) {
    const scores = allScores[i]
    for (const scoreEntry of scores) {
      await db.questionScore.create({
        data: {
          id: randomUUID(),
          cropRegionId: cropRegionIds[scoreEntry.regionIndex],
          examStudentId: examStudentIds[i],
          partialScore: scoreEntry.score,
          status: scoreEntry.status,
          userId,
        },
      })
    }
  }

  console.log(
    `  [SEED] 試験 + 採点 (examId=${examId}, ${REGION_DEFINITIONS.length}領域)`
  )
  return examId
}

// ---------------------------------------------------------------------------
// 成績算出プロジェクト
// ---------------------------------------------------------------------------
export async function seedGradeProject(
  examId: string,
  studentIds: string[],
  classAId: string,
  classBId: string,
  subtotalIds: string[],
  // templatePath: 旧実装は領域定義から満点を算出していたが、満点はライブ算出になり不要化
  _templatePath: string
): Promise<string> {
  const db = getPrisma()

  const gradeId = randomUUID()
  await db.grade.create({
    data: {
      id: gradeId,
      name: "第２回定期テスト 数学 成績",
      description: "成績算出サンプル",
      referenceDate: new Date("2025-11-01"),
    },
  })
  for (const classroomId of [classAId, classBId]) {
    await db.gradeClassroom.create({
      data: { id: randomUUID(), gradeId, classroomId },
    })
  }
  for (let i = 0; i < studentIds.length; i++) {
    await db.gradeStudent.create({
      data: {
        id: randomUUID(),
        gradeId,
        studentId: studentIds[i],
        customOrder: i + 1,
      },
    })
  }

  const subtotalNames = [
    "知識・技能",
    "思考・判断・表現",
    "主体的に学習に取り組む態度",
  ]
  // 4つの成績項目: 3つの小計 + 評定（合計点）
  const gradeItemNames = [
    "知識・技能",
    "思考・判断・表現",
    "主体的に学習に取り組む態度",
    "評定",
  ]
  const gradeItemIds: string[] = []
  for (let i = 0; i < gradeItemNames.length; i++) {
    const gradeItem = await db.gradeItem.create({
      data: { id: randomUUID(), gradeId, name: gradeItemNames[i], order: i },
    })
    gradeItemIds.push(gradeItem.id)
  }

  // 評定 → 合計点データソース
  await db.gradeDataSource.create({
    data: {
      id: randomUUID(),
      gradeItemId: gradeItemIds[3],
      type: "exam_total",
      examId,
      name: "第２回定期テスト 数学（合計点）",
      weight: 1.0,
    },
  })
  // 3つの小計それぞれにデータソースを作成
  // Q1-Q3: 知識・技能, Q4-Q5: 思考・判断・表現, Q6-Q7: 主体的に学習に取り組む態度
  for (let subtotalIndex = 0; subtotalIndex < 3; subtotalIndex++) {
    await db.gradeDataSource.create({
      data: {
        id: randomUUID(),
        gradeItemId: gradeItemIds[subtotalIndex],
        type: "subtotal",
        examId,
        subtotalId: subtotalIds[subtotalIndex],
        name: subtotalNames[subtotalIndex],
        weight: 1.0,
      },
    })
  }

  const boundaryLabels = [
    { label: "A", minPercentage: 80 },
    { label: "B", minPercentage: 65 },
    { label: "C", minPercentage: 50 },
    { label: "D", minPercentage: 35 },
    { label: "E", minPercentage: 0 },
  ]
  for (const gradeItemId of gradeItemIds) {
    const boundarySet = await db.gradeBoundarySet.create({
      data: { id: randomUUID(), gradeId, gradeItemId },
    })
    for (
      let boundaryIndex = 0;
      boundaryIndex < boundaryLabels.length;
      boundaryIndex++
    ) {
      await db.gradeBoundary.create({
        data: {
          id: randomUUID(),
          gradeBoundarySetId: boundarySet.id,
          label: boundaryLabels[boundaryIndex].label,
          minPercentage: boundaryLabels[boundaryIndex].minPercentage,
          order: boundaryIndex,
        },
      })
    }
  }

  console.log(`  [SEED] 成績算出プロジェクト (gradeId=${gradeId})`)
  return gradeId
}

// ---------------------------------------------------------------------------
// 第2の試験（通常アップロード経路）— マスター画像は後からUIで確認用
// ---------------------------------------------------------------------------
export async function seedSimpleExam(
  userId: string,
  classAId: string
): Promise<string> {
  const db = getPrisma()
  const examId = randomUUID()
  await db.exam.create({
    data: {
      id: examId,
      examName: "第１回実力テスト 中２英語",
      examDate: new Date("2025-07-10"),
      description: "Lesson 1-4 まとめ",
    },
  })
  await db.userExam.create({
    data: { id: randomUUID(), userId, examId, role: "OWNER" },
  })
  await db.examClassroom.create({
    data: {
      id: randomUUID(),
      examId,
      classroomId: classAId,
      administered: true,
      teacherStatistics: true,
      studentReport: true,
    },
  })
  await db.examPage.create({
    data: { id: randomUUID(), examId, pageNumber: 1 },
  })
  console.log(`  [SEED] 通常試験 (examId=${examId})`)
  return examId
}

// ---------------------------------------------------------------------------
// ASBマスター画像ベースで答案画像を再生成
// ---------------------------------------------------------------------------
export async function regenerateAnswerImages(
  examId: string,
  studentIds: string[],
  templatePath: string,
  masterDir: string
): Promise<void> {
  const REGION_DEFINITIONS = computeRegionDefinitions(templatePath)
  const answerDir = path.join(TEST_DATA_DIR, "exams", examId, "answer-sheets")
  fs.mkdirSync(answerDir, { recursive: true })

  // 模範解答画像に正答テキストをオーバーレイ
  await generateMasterAnswerImage(masterDir, REGION_DEFINITIONS)

  for (let i = 0; i < studentIds.length; i++) {
    const scores = generateStudentScores(i, REGION_DEFINITIONS)
    await generateStudentAnswerImage(
      answerDir,
      i,
      studentIds[i],
      masterDir,
      REGION_DEFINITIONS,
      scores
    )
  }
  console.log(`  [REGEN] 模範解答 + 答案画像 ${studentIds.length}枚を再生成`)
}
