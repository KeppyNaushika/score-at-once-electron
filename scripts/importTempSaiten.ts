/**
 * .temp_saiten データを Score at Once DB にインポートするスクリプト
 *
 * 設定:
 *   importTempSaiten.config.example.json をコピーして
 *   importTempSaiten.config.json を作成し、パス等を設定してください。
 *
 * 使用方法:
 *   npx tsx scripts/importTempSaiten.ts                          # DB + 模範解答のみ
 *   npx tsx scripts/importTempSaiten.ts --with-answers           # 答案画像もコピー
 *   npx tsx scripts/importTempSaiten.ts --config path/to/config  # 設定ファイル指定
 */

import { PrismaClient } from "@prisma/client"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

// =============================================================================
// 設定
// =============================================================================

const WITH_ANSWERS = process.argv.includes("--with-answers")

const DATA_DIR = path.resolve(__dirname, "../data")
const DB_PATH = path.resolve(DATA_DIR, "database.db")

// 設定ファイル読み込み
const configArgIndex = process.argv.indexOf("--config")
const CONFIG_PATH =
  configArgIndex >= 0
    ? path.resolve(process.argv[configArgIndex + 1])
    : path.resolve(__dirname, "importTempSaiten.config.json")

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(
    `設定ファイルが見つかりません: ${CONFIG_PATH}\n` +
      `importTempSaiten.config.example.json をコピーして設定してください。`
  )
  process.exit(1)
}

interface ExamGroupPage {
  /** sourceBase からの相対パス（.temp_saiten サブディレクトリ内） */
  path?: string
  /** 絶対パス（データファイルが直接格納されたディレクトリ） */
  dir?: string
}

interface ExamGroup {
  name: string
  pages: ExamGroupPage[]
}

interface ImportConfig {
  /** pages.path 使用時のベースディレクトリ（pages.dir 使用時は不要） */
  sourceBase?: string
  userId: string
  subject: string
  classMap: Record<string, string>
  examGroups: ExamGroup[]
}

const CONFIG: ImportConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
const USER_ID = CONFIG.userId
const SUBJECT = CONFIG.subject
const CLASS_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(CONFIG.classMap).map(([k, v]) => [Number(k), v])
)
const EXAM_GROUPS: ExamGroup[] = CONFIG.examGroups

const TYPE_MAP: Record<string, string> = {
  設問: "QUESTION_ANSWER",
  氏名: "STUDENT_NAME",
  生徒番号: "STUDENT_ID",
  合計点: "TOTAL_SCORE",
  小計点: "SUBTOTAL_SCORE",
  採点者印: "SCORER_STAMP",
}

// =============================================================================
// 型定義
// =============================================================================

interface MeiboEntry {
  学年: number | null
  学級: number | null
  出席番号: number | null
  生徒番号: string | null
  氏名: string | null
}

interface QuestionEntry {
  type: string
  daimon: string | number | null
  shomon: string | number | null
  shimon: string | number | null
  haiten: number | null
  area: [number, number, number, number]
  score: Array<{ status: string; point: number | null }>
}

// =============================================================================
// ユーティリティ
// =============================================================================

/** ページ設定からデータディレクトリの絶対パスを解決する */
function resolvePageDir(page: ExamGroupPage): string {
  if (page.dir) return page.dir
  if (page.path) {
    if (!CONFIG.sourceBase) {
      throw new Error("pages.path を使用する場合は sourceBase の設定が必要です")
    }
    return path.join(CONFIG.sourceBase, page.path, ".temp_saiten")
  }
  throw new Error("ページには path または dir のどちらかが必要です")
}

function readPngDimensions(filePath: string): {
  width: number
  height: number
} {
  const buf = fs.readFileSync(filePath)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function copyFileWithRetry(src: string, dst: string, maxRetries = 3): void {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.copyFileSync(src, dst)
      return
    } catch (e) {
      if (attempt === maxRetries) throw e
      console.log(
        `      リトライ ${attempt}/${maxRetries}: ${path.basename(src)}`
      )
    }
  }
}

function buildLabel(q: QuestionEntry): string {
  if (q.type !== "設問") return q.type
  const parts: string[] = []
  if (q.daimon != null) parts.push(String(q.daimon))
  if (q.shomon != null) parts.push(String(q.shomon))
  let label = parts.join("-")
  if (q.shimon != null) label += `(${q.shimon})`
  return label || "設問"
}

// =============================================================================
// メイン
// =============================================================================

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
    log: ["error"],
  })

  try {
    await prisma.$connect()
    console.log(`DB接続成功 (答案画像: ${WITH_ANSWERS ? "あり" : "なし"})`)

    // クラスIDマップ
    const classIdMap = new Map<number, string>()
    for (const [num, name] of Object.entries(CLASS_MAP)) {
      const cls = await prisma.class.findFirst({ where: { name } })
      if (!cls) throw new Error(`クラス「${name}」が見つかりません`)
      classIdMap.set(Number(num), cls.id)
    }

    // 生徒マッチング用マップ
    const studentByKey = new Map<string, string>()
    const studentByName = new Map<string, string>()
    for (const [classNum, classId] of classIdMap) {
      const memberships = await prisma.studentClassMembership.findMany({
        where: { classId },
        include: { student: true },
      })
      for (const m of memberships) {
        if (m.attendanceNumber != null) {
          studentByKey.set(`${classNum}-${m.attendanceNumber}`, m.student.id)
        }
        studentByName.set(
          `${m.student.lastName}　${m.student.firstName}`,
          m.student.id
        )
      }
    }

    // クラスメンバー一覧（欠席者検出用）
    const classMembers = new Map<string, string[]>()
    for (const [, classId] of classIdMap) {
      const memberships = await prisma.studentClassMembership.findMany({
        where: { classId },
      })
      classMembers.set(
        classId,
        memberships.map((m) => m.studentId)
      )
    }

    console.log(
      `マップ構築完了 (出席番号${studentByKey.size}, 氏名${studentByName.size})`
    )

    let ok = 0
    for (const group of EXAM_GROUPS) {
      try {
        await importExam(
          prisma,
          group,
          classIdMap,
          studentByKey,
          studentByName,
          classMembers
        )
        ok++
      } catch (e) {
        console.error(`✗ ${group.name}: ${e}`)
      }
    }
    console.log(`\n完了: ${ok}/${EXAM_GROUPS.length} 試験`)
  } finally {
    await prisma.$disconnect()
  }
}

async function importExam(
  prisma: PrismaClient,
  group: ExamGroup,
  classIdMap: Map<number, string>,
  studentByKey: Map<string, string>,
  studentByName: Map<string, string>,
  classMembers: Map<string, string[]>
) {
  const existing = await prisma.exam.findFirst({
    where: { examName: group.name },
  })
  if (existing) {
    console.log(`⏭ ${group.name}: スキップ（既存）`)
    return
  }

  const examId = crypto.randomUUID()
  const now = new Date()

  // ソース読み込み
  type PageData = {
    meibo: MeiboEntry[]
    questions: QuestionEntry[]
    dataDir: string
    imgW: number
    imgH: number
  }
  const pages: PageData[] = group.pages.map((p) => {
    const dir = resolvePageDir(p)
    const meibo: MeiboEntry[] = JSON.parse(
      fs.readFileSync(path.join(dir, "meibo.json"), "utf8")
    )
    const { questions } = JSON.parse(
      fs.readFileSync(path.join(dir, "answer_area.json"), "utf8")
    )
    const { width: imgW, height: imgH } = readPngDimensions(
      path.join(dir, "model_answer", "model_answer.png")
    )
    return { meibo, questions, dataDir: dir, imgW, imgH }
  })

  // 生徒マッチング
  const participatingStudentIds = new Set<string>()
  const allClassIds = new Set<string>()
  const pageMeiboMaps: Map<number, string>[] = []
  const unmatched = new Set<string>()

  for (const page of pages) {
    const mm = new Map<number, string>()
    const sidToIndex = new Map<string, number>()
    for (let i = 0; i < page.meibo.length; i++) {
      const e = page.meibo[i]
      if (!e.氏名 || e.学級 == null || e.出席番号 == null) continue
      let sid = studentByKey.get(`${e.学級}-${e.出席番号}`)
      if (!sid) sid = studentByName.get(e.氏名.replace(/ /g, "　"))
      if (sid) {
        // 同一生徒が既にいる場合、後のindex（再追加=修正版）を優先
        const prevIndex = sidToIndex.get(sid)
        if (prevIndex !== undefined) {
          mm.delete(prevIndex)
          console.log(
            `  📌 重複検出: ${e.氏名} index ${prevIndex} → ${i} に更新`
          )
        }
        mm.set(i, sid)
        sidToIndex.set(sid, i)
        participatingStudentIds.add(sid)
        const cid = classIdMap.get(e.学級)
        if (cid) allClassIds.add(cid)
      } else {
        unmatched.add(e.氏名)
      }
    }
    pageMeiboMaps.push(mm)
  }

  if (unmatched.size > 0) {
    console.log(`  ⚠ 未マッチ: ${[...unmatched].join(", ")}`)
  }

  // 欠席者: ExamClassに紐づく全生徒のうち、名簿にない生徒
  const absentStudentIds = new Set<string>()
  for (const classId of allClassIds) {
    const members = classMembers.get(classId) || []
    for (const sid of members) {
      if (!participatingStudentIds.has(sid)) {
        absentStudentIds.add(sid)
      }
    }
  }

  // 実施日推定（answer_area.jsonの更新日）
  const firstDataDir = pages[0].dataDir
  const aaStat = fs.statSync(path.join(firstDataDir, "answer_area.json"))
  const examDate = aaStat.mtime

  // 画像コピー
  const examDir = path.join(DATA_DIR, "exams", examId)
  fs.mkdirSync(path.join(examDir, "master-answers"), { recursive: true })
  if (WITH_ANSWERS) {
    fs.mkdirSync(path.join(examDir, "answer-sheets"), { recursive: true })
  }

  const masterRelPaths: string[] = []
  const answerRelPaths = new Map<string, string>()

  for (let pi = 0; pi < pages.length; pi++) {
    const fn = `master-page-${pi + 1}.png`
    copyFileWithRetry(
      path.join(pages[pi].dataDir, "model_answer", "model_answer.png"),
      path.join(examDir, "master-answers", fn)
    )
    masterRelPaths.push(`exams/${examId}/master-answers/${fn}`)

    if (WITH_ANSWERS) {
      const answerSrcDir = path.join(pages[pi].dataDir, "answer")
      const existingFiles = new Set(
        fs.readdirSync(answerSrcDir).filter((f) => f.endsWith(".png"))
      )
      for (const [meiboIdx, studentId] of pageMeiboMaps[pi]) {
        const srcFile = `${meiboIdx}.png`
        if (!existingFiles.has(srcFile)) continue
        const dstFile = `${studentId}-page-${pi + 1}.png`
        copyFileWithRetry(
          path.join(answerSrcDir, srcFile),
          path.join(examDir, "answer-sheets", dstFile)
        )
        answerRelPaths.set(
          `${pi}-${meiboIdx}`,
          `exams/${examId}/answer-sheets/${dstFile}`
        )
      }
      console.log(`    答案コピー ページ${pi + 1}: ${pageMeiboMaps[pi].size}枚`)
    }
  }

  // ===== DB挿入 =====
  await prisma.exam.create({
    data: {
      id: examId,
      examName: group.name,
      examDate,
      createdAt: now,
      updatedAt: now,
    },
  })
  await prisma.userExam.create({
    data: {
      id: crypto.randomUUID(),
      userId: USER_ID,
      examId,
      role: "OWNER",
      createdAt: now,
      updatedAt: now,
    },
  })

  // ExamClass（学級番号順にorder設定）
  const sortedClassIds = [...allClassIds].sort((a, b) => {
    const aNum = [...classIdMap.entries()].find(([, v]) => v === a)?.[0] ?? 99
    const bNum = [...classIdMap.entries()].find(([, v]) => v === b)?.[0] ?? 99
    return aNum - bNum
  })
  for (let i = 0; i < sortedClassIds.length; i++) {
    await prisma.examClass.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        classId: sortedClassIds[i],
        administered: true,
        statistics: true,
        order: i,
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  // ExamStudent（受験者 + 欠席者）
  // 学級順→出席番号順でcustomOrderを振る
  const allStudentIdsForExam = [...participatingStudentIds, ...absentStudentIds]

  const studentClassInfo = await prisma.studentClassMembership.findMany({
    where: {
      studentId: { in: allStudentIdsForExam },
      classId: { in: sortedClassIds },
    },
  })
  const studentInfoMap = new Map<
    string,
    { classOrder: number; attendance: number }
  >()
  for (const m of studentClassInfo) {
    const classOrder = sortedClassIds.indexOf(m.classId)
    if (classOrder >= 0) {
      studentInfoMap.set(m.studentId, {
        classOrder,
        attendance: m.attendanceNumber ?? 9999,
      })
    }
  }

  const sortedAllStudents = allStudentIdsForExam.sort((a, b) => {
    const ai = studentInfoMap.get(a) ?? { classOrder: 99, attendance: 9999 }
    const bi = studentInfoMap.get(b) ?? { classOrder: 99, attendance: 9999 }
    if (ai.classOrder !== bi.classOrder) return ai.classOrder - bi.classOrder
    return ai.attendance - bi.attendance
  })

  for (let i = 0; i < sortedAllStudents.length; i++) {
    const sid = sortedAllStudents[i]
    await prisma.examStudent.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        studentId: sid,
        status: absentStudentIds.has(sid) ? "ABSENT" : "PARTICIPATING",
        customOrder: i,
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  console.log(
    `  📝 生徒: 受験${participatingStudentIds.size}名, 欠席${absentStudentIds.size}名`
  )

  // ページごとの処理
  let globalOrder = 0
  let totalScores = 0

  // 大問→CropRegion IDのマッピング（全ページ分蓄積）
  const daimonToCropIds = new Map<string, string[]>()
  const subtotalMap = new Map<string, string>()

  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi]
    const mm = pageMeiboMaps[pi]
    const pageNum = pi + 1
    const examPageId = crypto.randomUUID()

    await prisma.examPage.create({
      data: {
        id: examPageId,
        examId,
        pageNumber: pageNum,
        createdAt: now,
        updatedAt: now,
      },
    })
    await prisma.masterImage.create({
      data: {
        id: crypto.randomUUID(),
        examPageId,
        imagePath: masterRelPaths[pi],
        pageSize: "A4",
        createdAt: now,
        updatedAt: now,
      },
    })

    // StudentAnswerImage
    if (WITH_ANSWERS) {
      const seenStudents = new Set<string>()
      const answerRows = [...mm.entries()]
        .map(([idx, sid]) => {
          const rp = answerRelPaths.get(`${pi}-${idx}`)
          if (!rp || seenStudents.has(sid)) return null
          seenStudents.add(sid)
          return {
            id: crypto.randomUUID(),
            examPageId,
            studentId: sid,
            imagePath: rp,
            createdAt: now,
            updatedAt: now,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
      if (answerRows.length > 0) {
        await prisma.studentAnswerImage.createMany({ data: answerRows })
      }
    }

    // CropRegion + QuestionScore
    for (const q of page.questions) {
      const cropType = TYPE_MAP[q.type]
      if (!cropType) continue

      const cropRegionId = crypto.randomUUID()
      const [x1, y1, x2, y2] = q.area
      const isQ = q.type === "設問"
      const isSubtotal = q.type === "小計点"

      await prisma.cropRegion.create({
        data: {
          id: cropRegionId,
          examPageId,
          label: buildLabel(q),
          type: cropType,
          x: x1 / page.imgW,
          y: y1 / page.imgH,
          width: (x2 - x1) / page.imgW,
          height: (y2 - y1) / page.imgH,
          points: q.haiten ?? null,
          orderIndex: isQ ? globalOrder++ : null,
          createdAt: now,
          updatedAt: now,
        },
      })

      // 大問追跡
      if (isQ && q.daimon != null) {
        const d = String(q.daimon)
        const ids = daimonToCropIds.get(d) || []
        ids.push(cropRegionId)
        daimonToCropIds.set(d, ids)
      }
      if (isSubtotal && q.daimon != null) {
        subtotalMap.set(String(q.daimon), cropRegionId)
      }

      if (!isQ || !q.score) continue

      const scoreRows: Array<{
        id: string
        cropRegionId: string
        studentId: string
        partialScore: number | null
        status: string
        userId: string
        createdAt: Date
        updatedAt: Date
      }> = []

      for (let mi = 0; mi < q.score.length; mi++) {
        const sid = mm.get(mi)
        if (!sid) continue
        const s = q.score[mi]
        if (s.status === "unscored") continue

        let ps: number | null = null
        if (s.status === "correct") ps = q.haiten ?? null
        else if (s.status === "incorrect") ps = 0
        else if (s.status === "partial") ps = s.point

        scoreRows.push({
          id: crypto.randomUUID(),
          cropRegionId,
          studentId: sid,
          partialScore: ps,
          status: s.status,
          userId: USER_ID,
          createdAt: now,
          updatedAt: now,
        })
      }

      if (scoreRows.length > 0) {
        await prisma.questionScore.createMany({ data: scoreRows })
        totalScores += scoreRows.length
      }
    }
  }

  // SubtotalGroup作成（大問データがある場合）
  if (daimonToCropIds.size > 0) {
    const groupId = crypto.randomUUID()
    await prisma.subtotalGroup.create({
      data: { id: groupId, name: "大問", createdAt: now, updatedAt: now },
    })
    await prisma.examSubtotalGroup.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        subtotalGroupId: groupId,
        createdAt: now,
        updatedAt: now,
      },
    })

    const sortedDaimons = [...daimonToCropIds.keys()].sort((a, b) => {
      const na = parseInt(a, 10),
        nb = parseInt(b, 10)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })

    for (let i = 0; i < sortedDaimons.length; i++) {
      const d = sortedDaimons[i]
      const subtotalId = crypto.randomUUID()
      await prisma.subtotal.create({
        data: {
          id: subtotalId,
          name: `大問${d}`,
          subtotalGroupId: groupId,
          order: i,
          createdAt: now,
          updatedAt: now,
        },
      })
      for (const cropId of daimonToCropIds.get(d) || []) {
        await prisma.cropSubtotal.create({
          data: {
            id: crypto.randomUUID(),
            cropRegionId: cropId,
            subtotalId,
            assignmentType: "QUESTION_ASSIGNMENT",
            createdAt: now,
            updatedAt: now,
          },
        })
      }
      const stCropId = subtotalMap.get(d)
      if (stCropId) {
        await prisma.cropSubtotal.create({
          data: {
            id: crypto.randomUUID(),
            cropRegionId: stCropId,
            subtotalId,
            assignmentType: "SUBTOTAL_DEFINITION",
            createdAt: now,
            updatedAt: now,
          },
        })
      }
    }
    console.log(`  📊 小計: 大問${sortedDaimons.length}個`)
  }

  const totalQ = pages.reduce(
    (s, p) => s + p.questions.filter((q) => q.type === "設問").length,
    0
  )
  console.log(
    `  ✓ ${group.name}: ${pages.length}ページ, ${totalQ}設問, ${totalScores}スコア, 実施日=${examDate.toISOString().split("T")[0]}`
  )
}

main().catch((e) => {
  console.error("致命的エラー:", e)
  process.exit(1)
})
