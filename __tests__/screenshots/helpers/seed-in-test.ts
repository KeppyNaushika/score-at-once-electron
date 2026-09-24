/**
 * テスト実行中にデータを段階的に追加するヘルパー
 *
 * テストプロセスからPrismaClientを直接操作してデータを追加する。
 * Electronのメインプロセスは経由しない。
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@prisma/client"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"
import sharp from "sharp"

import {
  computeHeaderFieldBoxes,
  computeRegionDefinitions,
  generateMasterAnswerImage,
  generateStudentAnswerImage,
  generateStudentScores,
  type StudentHeader,
} from "./generate-images"
import { requireNodeAbiBinding } from "./nodeAbiBinding"

// ---------------------------------------------------------------------------
// PrismaClient（テストプロセスから直接DB操作）
// ---------------------------------------------------------------------------
const TEST_DATA_DIR = path.join(__dirname, "../data")
const DB_PATH = path.join(TEST_DATA_DIR, "database.db")

let prisma: PrismaClient

function getPrisma(): PrismaClient {
  if (!prisma) {
    // node_modules のバイナリは Electron 向けにそろえてある（アプリが DB を開けるように）。
    // こちらは素の Node なので、退避しておいたコピーを名指しで読む。
    // 経緯は `nodeAbiBinding.ts`
    prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: DB_PATH,
        nativeBinding: requireNodeAbiBinding(),
      }),
      log: ["error"],
    })
  }
  return prisma
}

export async function disconnectPrisma() {
  if (prisma) await prisma.$disconnect()
}

/**
 * 種データが撮影用 DB に入っていることを確かめる
 *
 * `screenshot-ids.json` は前回の setup が途中で落ちても残るので、ファイルの有無
 * だけでは「古い ID を指したまま」「DB が空のまま」を見分けられない。撮影の土台
 * なので、ここで実際に引けなければ落とす。
 *
 * @param userId - `screenshot-ids.json` が指す撮影用ユーザーの id
 * @throws 種データが見つからない場合
 */
export async function assertSeedLoaded(userId: string): Promise<void> {
  const user = await getPrisma().user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error(
      `撮影用DBに種データがありません（ユーザー ${userId} が見つかりません）。\n` +
        `${DB_PATH} を作り直してください: npm run screenshot:setup`
    )
  }
}

// ---------------------------------------------------------------------------
// 生徒名データ（40名）
// ---------------------------------------------------------------------------
const STUDENT_DATA = [
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

/**
 * 答案の記入欄に書く受験番号と氏名
 *
 * 受験番号は「学年・組・出席番号」の4桁（2年A組1番なら 2101）。学級の割り当て
 * （`seedClasses`: 先頭20名が A組、残りが B組）と揃えてある。
 */
function studentHeaderFor(studentIndex: number): StudentHeader {
  const studentData = STUDENT_DATA[studentIndex]
  const classNumber = studentIndex < 20 ? 1 : 2
  const attendanceNumber = (studentIndex % 20) + 1
  return {
    examineeNumber: `2${classNumber}${String(attendanceNumber).padStart(2, "0")}`,
    name: studentData ? `${studentData.lastName} ${studentData.firstName}` : "",
  }
}

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
        id: crypto.randomUUID(),
        studentNumber: `S${String(i + 1).padStart(3, "0")}`,
        lastName: studentData.lastName,
        firstName: studentData.firstName,
        lastNameKana: studentData.lastNameKana,
        firstNameKana: studentData.firstNameKana,
        // 2025年度（試験・成績の日付の年度）に2年生の学年
        enrollmentYear: 2024,
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
/**
 * 学級に入った日（2025年度の始まり）
 *
 * 既定値（作成した日＝撮影した日）のままだと、2025年10月の試験の時点で誰も
 * 学級に居ないことになる。アプリは試験日に在籍していた生徒を数えるので、
 * 成績や出力の画面の学級が軒並み「0名」になる。
 */
const SCHOOL_YEAR_START = new Date("2025-04-01T00:00:00+09:00")

export async function seedClasses(
  studentIds: string[]
): Promise<{ classAId: string; classBId: string }> {
  const db = getPrisma()
  const classroomA = await db.classroom.create({
    data: { id: crypto.randomUUID(), name: "2年A組", grade: 2 },
  })
  const classroomB = await db.classroom.create({
    data: { id: crypto.randomUUID(), name: "2年B組", grade: 2 },
  })
  for (let i = 0; i < 20; i++) {
    await db.studentClassroomMembership.create({
      data: {
        id: crypto.randomUUID(),
        studentId: studentIds[i],
        classroomId: classroomA.id,
        attendanceNumber: i + 1,
        startDate: SCHOOL_YEAR_START,
      },
    })
  }
  for (let i = 20; i < 40; i++) {
    await db.studentClassroomMembership.create({
      data: {
        id: crypto.randomUUID(),
        studentId: studentIds[i],
        classroomId: classroomB.id,
        attendanceNumber: i - 19,
        startDate: SCHOOL_YEAR_START,
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
    data: { id: crypto.randomUUID(), name: "観点別評価" },
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
        id: crypto.randomUUID(),
        name: subtotalNames[i],
        subtotalGroupId: subtotalGroup.id,
        order: i,
      },
    })
    subtotalIds.push(subtotal.id)
  }
  // タグ管理の画面が1行だけにならないよう、種類の違うタグを3つ置く
  // （教科・試験種別・時期。どれも架空の運用を模したもの）
  const tagNames = ["数学", "定期考査", "２学期"]
  const [subjectTag] = await Promise.all(
    tagNames.map((tagName, tagOrder) =>
      db.tag.create({
        data: { id: crypto.randomUUID(), name: tagName, order: tagOrder },
      })
    )
  )
  await db.tagSubtotalGroup.create({
    data: {
      id: crypto.randomUUID(),
      tagId: subjectTag.id,
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
  const headerFieldBoxes = computeHeaderFieldBoxes(templatePath)

  const examId = crypto.randomUUID()
  await db.exam.create({
    data: {
      id: examId,
      examName: "第２回定期テスト 中２数学",
      referenceDate: new Date("2025-10-15"),
      description: "一次関数・連立方程式",
    },
  })
  await db.userExam.create({
    data: { id: crypto.randomUUID(), userId, examId, role: "OWNER" },
  })
  for (const classroomId of [classAId, classBId]) {
    await db.examClassroom.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        classroomId,
        administered: true,
        teacherStatistics: true,
        studentReport: true,
      },
    })
  }
  await db.examSubtotalGroup.create({
    data: {
      examId,
      subtotalGroupId,
    },
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
  const examPage = await db.examPage.create({
    data: {
      id: crypto.randomUUID(),
      examId,
      pageNumber: 1,
      imagePath: relMasterPath,
    },
  })

  // 採点領域
  const cropRegionIds: string[] = []
  for (const region of REGION_DEFINITIONS) {
    const cropRegion = await db.cropRegion.create({
      data: {
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
      allScores[i],
      { student: studentHeaderFor(i), boxes: headerFieldBoxes }
    )
    const answerPath = path.join(answerDir, `${studentId}_page1.png`)
    const relAnswerPath = path
      .relative(TEST_DATA_DIR, answerPath)
      .replace(/\\/g, "/")
    await db.studentAnswerImage.create({
      data: {
        id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
// 2人目の採点者と、食い違いのある採点
// ---------------------------------------------------------------------------

/**
 * 2人目の採点者を試験へ入れ、担当を割り当て、食い違う採点を書く
 *
 * **協調採点の画面は、参加者が1人だと構造的に写らない。**
 *
 * - 段階3 の「採点担当」タブは `memberCount > 1` でしか現れない
 *   （`countExamMembers` は UserExam の行数を数える）
 * - 段階8 の裁定は、同じマス（設問 × 受験者）に**食い違う提案**が無いと
 *   「裁くものが無い」画面になる。食い違いの判定は userId を見ておらず、
 *   同じマスの提案どうしで `status` と `partialScore` が揃わなければ conflict
 *   （`scoreResolution.ts` の `resolveScores`）
 *
 * 名前は架空のもの。実在の人物とは関係がない。
 *
 * @returns 2人目の採点者の id と、作った食い違いのマス数
 */
export async function seedSecondGrader(
  examId: string,
  ownerUserId: string,
  templatePath: string
): Promise<{ graderUserId: string; conflictCellCount: number }> {
  const db = getPrisma()
  const regionDefinitions = computeRegionDefinitions(templatePath)

  const grader = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      username: "otsuki-s",
      name: "大槻 里美",
      role: "teacher",
      passcodeType: "none",
    },
  })
  await db.userExam.create({
    data: {
      id: crypto.randomUUID(),
      userId: grader.id,
      examId,
      role: "GRADER",
      invitedBy: ownerUserId,
    },
  })

  // 担当の割り当て。設問を交互に分け、先頭の1問だけ両方の担当にする
  // （1設問に複数の担当を置けること＝ダブルチェックが対応表に写るように）
  const cropRegions = await db.cropRegion.findMany({
    where: { examPage: { examId }, type: "QUESTION_ANSWER" },
    orderBy: { orderIndex: "asc" },
  })
  await Promise.all(
    cropRegions.map((cropRegion, regionOrder) =>
      db.cropRegionAssignment.create({
        data: {
          id: crypto.randomUUID(),
          cropRegionId: cropRegion.id,
          userId: regionOrder % 2 === 0 ? ownerUserId : grader.id,
          assignedBy: ownerUserId,
        },
      })
    )
  )
  if (cropRegions.length > 0) {
    await db.cropRegionAssignment.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: cropRegions[0].id,
        userId: grader.id,
        assignedBy: ownerUserId,
      },
    })
  }

  // 2人目の採点。担当している設問（奇数番目）だけを付ける。
  // 多くは1人目と同じ判定にし、一定の割合だけずらして食い違いを作る
  const examStudents = await db.examStudent.findMany({
    where: { examId },
    orderBy: { customOrder: "asc" },
  })
  const graderRegions = cropRegions.filter(
    (_cropRegion, regionOrder) => regionOrder % 2 === 1
  )
  let conflictCellCount = 0

  for (const [studentOrder, examStudent] of examStudents.entries()) {
    const ownerScores = generateStudentScores(studentOrder, regionDefinitions)
    for (const cropRegion of graderRegions) {
      const ownerScore = ownerScores.find(
        (score) => score.regionIndex === cropRegion.orderIndex
      )
      if (!ownerScore) continue

      const isConflict = (studentOrder + (cropRegion.orderIndex ?? 0)) % 9 === 0
      conflictCellCount += isConflict ? 1 : 0
      // 食い違いは「正答としたものを部分点にした」形にする。判定と点の両方が
      // ずれるので、どちらか片方しか見ていない実装があっても裁定対象になる
      const graderStatus = isConflict
        ? ownerScore.status === "correct"
          ? "partial"
          : "correct"
        : ownerScore.status
      const graderPartialScore = isConflict
        ? Math.max(1, Math.floor((cropRegion.points ?? 2) / 2))
        : ownerScore.score

      await db.questionScore.create({
        data: {
          id: crypto.randomUUID(),
          cropRegionId: cropRegion.id,
          examStudentId: examStudent.id,
          partialScore: graderPartialScore,
          status: graderStatus,
          userId: grader.id,
        },
      })
    }
  }

  console.log(
    `  [SEED] 2人目の採点者: 大槻 里美（食い違い ${conflictCellCount} マス）`
  )
  return { graderUserId: grader.id, conflictCellCount }
}

// ---------------------------------------------------------------------------
// 試験外成績資料（Coursework）
// ---------------------------------------------------------------------------

/**
 * 試験外成績資料を1件、点数まで入った状態で作る
 *
 * 資料の画面は評価項目が0件だと表そのものが出ない（`CourseworkScoresContainer`）。
 * 数値の項目だけでなく**文字評価の項目**も1つ置く ——「評語で付ける」は資料側にしか
 * 無い入力方式で、置かないと画面の半分が写らない。コメントも1件入れる
 * （結果画面の「コメント」列はコメントが1つ以上あるときだけ現れる）。
 *
 * 中身は架空のもの。
 */
export async function seedCoursework(
  studentIds: string[],
  classAId: string,
  classBId: string
): Promise<string> {
  const db = getPrisma()

  const courseworkId = crypto.randomUUID()
  await db.coursework.create({
    data: {
      id: courseworkId,
      name: "夏季課題 中２数学",
      description: "夏休みの提出物と、休み明けの確認テスト",
      referenceDate: new Date("2025-09-01"),
    },
  })
  await Promise.all(
    [classAId, classBId].map((classroomId, classroomOrder) =>
      db.courseworkClassroom.create({
        data: {
          id: crypto.randomUUID(),
          courseworkId,
          classroomId,
          order: classroomOrder,
        },
      })
    )
  )

  const courseworkStudentIds: string[] = []
  for (const [studentOrder, studentId] of studentIds.entries()) {
    const courseworkStudent = await db.courseworkStudent.create({
      data: {
        id: crypto.randomUUID(),
        courseworkId,
        studentId,
        customOrder: studentOrder + 1,
      },
    })
    courseworkStudentIds.push(courseworkStudent.id)
  }

  const submission = await db.courseworkItem.create({
    data: {
      id: crypto.randomUUID(),
      courseworkId,
      name: "課題プリント",
      order: 0,
      maxScore: 20,
      inputMode: "numeric",
    },
  })
  const checkTest = await db.courseworkItem.create({
    data: {
      id: crypto.randomUUID(),
      courseworkId,
      name: "確認テスト",
      order: 1,
      maxScore: 50,
      inputMode: "numeric",
    },
  })
  const attitude = await db.courseworkItem.create({
    data: {
      id: crypto.randomUUID(),
      courseworkId,
      name: "取り組みの様子",
      order: 2,
      maxScore: 3,
      inputMode: "letter",
    },
  })
  const letterScales = [
    { label: "A", score: 3 },
    { label: "B", score: 2 },
    { label: "C", score: 1 },
  ]
  await Promise.all(
    letterScales.map((letterScale, scaleOrder) =>
      db.courseworkLetterScale.create({
        data: {
          id: crypto.randomUUID(),
          courseworkItemId: attitude.id,
          label: letterScale.label,
          score: letterScale.score,
          order: scaleOrder,
        },
      })
    )
  )

  for (const [
    studentOrder,
    courseworkStudentId,
  ] of courseworkStudentIds.entries()) {
    await db.courseworkScore.create({
      data: {
        id: crypto.randomUUID(),
        courseworkItemId: submission.id,
        courseworkStudentId,
        score: 12 + ((studentOrder * 3) % 9),
      },
    })
    await db.courseworkScore.create({
      data: {
        id: crypto.randomUUID(),
        courseworkItemId: checkTest.id,
        courseworkStudentId,
        score: 28 + ((studentOrder * 7) % 23),
        // 数人だけコメントを入れる。全員に付けると列の意図（一部にだけ添える）が
        // 伝わらないし、全員空だと列そのものが出ない
        comment: studentOrder % 13 === 0 ? "計算の途中式が丁寧" : null,
      },
    })
    await db.courseworkScore.create({
      data: {
        id: crypto.randomUUID(),
        courseworkItemId: attitude.id,
        courseworkStudentId,
        letterValue: letterScales[studentOrder % letterScales.length].label,
      },
    })
  }

  console.log(`  [SEED] 試験外成績資料 (courseworkId=${courseworkId})`)
  return courseworkId
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

  const gradeId = crypto.randomUUID()
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
      data: { id: crypto.randomUUID(), gradeId, classroomId },
    })
  }
  for (let i = 0; i < studentIds.length; i++) {
    await db.gradeStudent.create({
      data: {
        id: crypto.randomUUID(),
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
      data: {
        id: crypto.randomUUID(),
        gradeId,
        name: gradeItemNames[i],
        order: i,
      },
    })
    gradeItemIds.push(gradeItem.id)
  }

  // 評定 → 合計点データソース
  await db.gradeDataSource.create({
    data: {
      id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
    for (
      let boundaryIndex = 0;
      boundaryIndex < boundaryLabels.length;
      boundaryIndex++
    ) {
      await db.gradeItemBoundary.create({
        data: {
          id: crypto.randomUUID(),
          gradeItemId,
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
// ASBマスター画像ベースで答案画像を再生成
// ---------------------------------------------------------------------------
export async function regenerateAnswerImages(
  examId: string,
  studentIds: string[],
  templatePath: string,
  masterDir: string
): Promise<void> {
  const REGION_DEFINITIONS = computeRegionDefinitions(templatePath)
  const headerFieldBoxes = computeHeaderFieldBoxes(templatePath)
  const answerDir = path.join(TEST_DATA_DIR, "exams", examId, "answer-sheets")
  fs.mkdirSync(answerDir, { recursive: true })

  // 生徒の答案を先に作る。模範解答の赤字はマスター画像を上書きするので、
  // 先にやると全員の答案に模範解答が写り込む
  for (let i = 0; i < studentIds.length; i++) {
    const scores = generateStudentScores(i, REGION_DEFINITIONS)
    await generateStudentAnswerImage(
      answerDir,
      i,
      studentIds[i],
      masterDir,
      REGION_DEFINITIONS,
      scores,
      { student: studentHeaderFor(i), boxes: headerFieldBoxes }
    )
  }

  // 模範解答画像に正答テキストをオーバーレイ
  await generateMasterAnswerImage(masterDir, REGION_DEFINITIONS)
  console.log(`  [REGEN] 模範解答 + 答案画像 ${studentIds.length}枚を再生成`)
}

// ---------------------------------------------------------------------------
// 残った食い違いの裁定
// ---------------------------------------------------------------------------

/**
 * 裁定されていない食い違いを、1人目（試験の持ち主）の判定で裁定する
 *
 * 採点確定の画面を撮るために食い違いを残してあるが、残したまま結果出力を撮ると
 * 困る。問題分析の識別係数・D値・α は全設問が確定した生徒だけで計算するので
 * （`src/lib/shared/itemAnalysis.ts`）、食い違いのある生徒が抜けて全行「---」になる。
 * 採点確定を撮り終えた後、結果出力の前に呼ぶ。画面で裁定済みのマスには触れない。
 *
 * @returns 裁定したマスの数
 */
export async function resolveRemainingConflicts(
  examId: string,
  ownerUserId: string
): Promise<number> {
  const db = getPrisma()
  const questionScores = await db.questionScore.findMany({
    where: { examStudent: { examId } },
  })
  const decidedCells = new Set(
    (
      await db.scoreDecision.findMany({
        where: { examStudent: { examId } },
        select: { cropRegionId: true, examStudentId: true },
      })
    ).map((decision) => `${decision.cropRegionId}:${decision.examStudentId}`)
  )

  const proposalsByCell = new Map<string, typeof questionScores>()
  for (const questionScore of questionScores) {
    const cellKey = `${questionScore.cropRegionId}:${questionScore.examStudentId}`
    proposalsByCell.set(cellKey, [
      ...(proposalsByCell.get(cellKey) ?? []),
      questionScore,
    ])
  }

  let resolvedCount = 0
  for (const [cellKey, proposals] of proposalsByCell) {
    if (decidedCells.has(cellKey) || proposals.length < 2) continue
    const isConflict = proposals.some(
      (proposal) =>
        proposal.status !== proposals[0].status ||
        Number(proposal.partialScore) !== Number(proposals[0].partialScore)
    )
    if (!isConflict) continue
    const ownerProposal =
      proposals.find((proposal) => proposal.userId === ownerUserId) ??
      proposals[0]
    await db.scoreDecision.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: ownerProposal.cropRegionId,
        examStudentId: ownerProposal.examStudentId,
        verdict: ownerProposal.status,
        score: ownerProposal.partialScore,
        decidedByUserId: ownerUserId,
      },
    })
    resolvedCount++
  }
  console.log(`  [SEED] 残りの食い違い ${resolvedCount} マスを裁定`)
  return resolvedCount
}

// ---------------------------------------------------------------------------
// 描いた注記を消す
// ---------------------------------------------------------------------------

/**
 * 試験の答案に描いた注記（アノテーション）を消す
 *
 * アノテーションの図のために描いたものが、最後に撮るヒーロー画像に残る
 * （消し忘れの赤い枠に見える）ので、撮る前に消す。
 */
export async function deleteDrawingAnnotations(
  examId: string
): Promise<number> {
  const { count } = await getPrisma().drawingAnnotation.deleteMany({
    where: { questionScore: { examStudent: { examId } } },
  })
  console.log(`  [SEED] 注記 ${count}件を削除`)
  return count
}

// ---------------------------------------------------------------------------
// 成績と試験外成績資料をつなぐ
// ---------------------------------------------------------------------------

/**
 * 成績の項目へ、試験外成績資料の評価項目をデータソースとしてつなぐ
 *
 * つながないと成績算出の「04 外部成績」が「試験外成績資料のデータソースが
 * ありません」だけの空の画面になる。画面から足したときと同じ形
 * （`type: "coursework"` ＋ `courseworkItemId`）で作る。
 *
 * - 確認テスト → 思考・判断・表現
 * - 課題プリント → 主体的に学習に取り組む態度
 */
export async function linkCourseworkToGrade(
  gradeId: string,
  courseworkId: string
): Promise<void> {
  const db = getPrisma()
  const coursework = await db.coursework.findUniqueOrThrow({
    where: { id: courseworkId },
    include: { items: true },
  })
  const gradeItems = await db.gradeItem.findMany({ where: { gradeId } })
  const links: [courseworkItemName: string, gradeItemName: string][] = [
    ["確認テスト", "思考・判断・表現"],
    ["課題プリント", "主体的に学習に取り組む態度"],
  ]
  for (const [courseworkItemName, gradeItemName] of links) {
    const courseworkItem = coursework.items.find(
      (item) => item.name === courseworkItemName
    )
    const gradeItem = gradeItems.find((item) => item.name === gradeItemName)
    if (!courseworkItem || !gradeItem) {
      throw new Error(
        `成績とつなぐ項目が見つかりません: ${courseworkItemName} → ${gradeItemName}`
      )
    }
    await db.gradeDataSource.create({
      data: {
        id: crypto.randomUUID(),
        gradeItemId: gradeItem.id,
        type: "coursework",
        courseworkItemId: courseworkItem.id,
        // 画面から足したときの既定名と同じ形（資料名(項目名)）
        name: `${coursework.name}(${courseworkItem.name})`,
        weight: 1.0,
        order: 1,
      },
    })
  }
  console.log(`  [SEED] 成績に試験外成績資料をつないだ（${links.length}件）`)
}

// ---------------------------------------------------------------------------
// 画面の操作に使う値
// ---------------------------------------------------------------------------

/** 名前から学級の id を引く（画面から作った学級の詳細を開くため） */
export async function findClassroomId(name: string): Promise<string> {
  const classroom = await getPrisma().classroom.findFirstOrThrow({
    where: { name },
  })
  return classroom.id
}

/**
 * 採点領域をドラッグで作るときの目標（用紙に対する割合）
 *
 * 氏名欄と、先頭の設問いくつか。画面からドラッグする位置を決めるのに使う。
 */
export async function sheetBoxesForDrawing(templatePath: string): Promise<{
  nameBox: { x: number; y: number; width: number; height: number }
  questionBoxes: {
    label: string
    x: number
    y: number
    width: number
    height: number
  }[]
}> {
  const nameBox = computeHeaderFieldBoxes(templatePath).find(
    (box) => box.label === "氏名"
  )
  if (!nameBox) throw new Error("テンプレートに氏名欄がありません")
  const questionBoxes = computeRegionDefinitions(templatePath)
    .slice(0, 4)
    .map(({ label, x, y, width, height }) => ({ label, x, y, width, height }))
  return { nameBox, questionBoxes }
}

// ---------------------------------------------------------------------------
// 画面からアップロードするファイル
// ---------------------------------------------------------------------------

/**
 * 画面から取り込ませるファイルを作る（模範解答の PNG と、全員分の答案の PDF）
 *
 * 採点付きの試験（`seedExamWithScoring` + `regenerateAnswerImages`）の画像から
 * 作る。どれも生成した架空の答案なので、公開する図に写ってよい。
 * 答案の PDF は出席番号順（A組→B組）の1人1ページで、スキャナーでまとめて
 * 読み込んだ形を模す。
 *
 * @returns 作ったファイルの絶対パス
 */
export async function buildUploadFiles(
  examId: string,
  studentIds: string[]
): Promise<{ masterAnswerPngPath: string; answerSheetsPdfPath: string }> {
  const examDir = path.join(TEST_DATA_DIR, "exams", examId)
  const uploadDir = path.join(TEST_DATA_DIR, "uploads")
  fs.mkdirSync(uploadDir, { recursive: true })

  const masterAnswerPngPath = path.join(uploadDir, "模範解答.png")
  fs.copyFileSync(
    path.join(examDir, "master-images", "master-page-1.png"),
    masterAnswerPngPath
  )

  const pdfDocument = await PDFDocument.create()
  for (const studentId of studentIds) {
    const answerPng = fs.readFileSync(
      path.join(examDir, "answer-sheets", `${studentId}_page1.png`)
    )
    // PDF を軽くするため JPEG にしてから載せる（40ページ分の PNG は重い）
    const answerJpeg = await sharp(answerPng).jpeg({ quality: 80 }).toBuffer()
    const embeddedImage = await pdfDocument.embedJpg(answerJpeg)
    // B4 縦（257mm × 364mm）をポイントで
    const pdfPage = pdfDocument.addPage([728.5, 1031.8])
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pdfPage.getWidth(),
      height: pdfPage.getHeight(),
    })
  }
  const answerSheetsPdfPath = path.join(uploadDir, "答案_スキャン.pdf")
  fs.writeFileSync(answerSheetsPdfPath, await pdfDocument.save())

  console.log(
    `  [SEED] アップロード用ファイル（模範解答PNG・答案PDF ${studentIds.length}ページ）`
  )
  return { masterAnswerPngPath, answerSheetsPdfPath }
}
