/**
 * 試験外成績資料アーカイブの外部参照（生徒・学級・タグ）ID 解決
 *
 * exam-archive と同じ「UUID 一次 + 名前マッチング（付加）」モデル:
 *   生徒  = UUID → 学籍番号 → 氏名
 *   学級  = UUID → 学級名
 *   タグ  = UUID → タグ名（無ければ upsert で作成）
 *
 * allowCreate=true（単体インポート）では未一致を新規作成（名前衝突はサフィックス回避）。
 * allowCreate=false（grade-archive 内包）では既存 lookup のみ、未一致はスキップ。
 */

import type {
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CourseworkMatchingMethod,
} from "../../../../src/types/courseworkArchive.types"
import {
  generateUniqueClassName,
  generateUniqueStudentNumber,
  type TransactionClient,
} from "../exam-archive/uniqueNameGenerators"

/** アーカイブ内 UUID → 実 DB ID のマッピング */
export type IdMap = Map<string, string>

/**
 * 生徒を解決する。返り値は archiveStudentId → 実 studentId のマップ。
 * 未解決（lookup-only で見つからない）生徒はマップに含めない。
 */
export async function resolveStudents(
  tx: TransactionClient,
  students: ArchiveCwStudent[],
  options: { method: CourseworkMatchingMethod; allowCreate: boolean }
): Promise<{ map: IdMap; warnings: string[] }> {
  const map: IdMap = new Map()
  const warnings: string[] = []
  const existing = await tx.student.findMany()
  const byId = new Map(existing.map((s) => [s.id, s]))
  const byNumber = new Map(existing.map((s) => [s.studentNumber, s]))
  const byName = new Map<string, (typeof existing)[number]>()
  for (const s of existing) {
    const key = `${s.lastName}|${s.firstName}`
    if (!byName.has(key)) byName.set(key, s)
  }

  for (const s of students) {
    // 1. UUID 一次照合
    const uuidMatch = byId.get(s.id)
    if (uuidMatch) {
      map.set(s.id, uuidMatch.id)
      continue
    }
    // 2. 二次照合
    let matched: (typeof existing)[number] | undefined
    if (options.method === "studentNumber") {
      matched = byNumber.get(s.studentNumber)
    } else if (options.method === "name") {
      matched = byName.get(`${s.lastName}|${s.firstName}`)
    }
    if (matched) {
      map.set(s.id, matched.id)
      continue
    }
    // 3. 新規作成 or スキップ
    if (!options.allowCreate) {
      warnings.push(
        `生徒「${s.lastName}${s.firstName}（${s.studentNumber}）」が見つからないためスキップしました`
      )
      continue
    }
    const uniqueNumber = await generateUniqueStudentNumber(tx, s.studentNumber)
    const created = await tx.student.create({
      data: {
        id: s.id,
        studentNumber: uniqueNumber,
        lastName: s.lastName,
        firstName: s.firstName,
        lastNameKana: s.lastNameKana,
        firstNameKana: s.firstNameKana,
        enrollmentYear: s.enrollmentYear,
      },
    })
    map.set(s.id, created.id)
  }

  return { map, warnings }
}

/** 学級を解決する。返り値は archiveClassId → 実 classroomId のマップ。 */
export async function resolveClasses(
  tx: TransactionClient,
  classes: ArchiveCwClass[],
  options: { allowCreate: boolean }
): Promise<{ map: IdMap; warnings: string[] }> {
  const map: IdMap = new Map()
  const warnings: string[] = []
  const existing = await tx.classroom.findMany()
  const byId = new Map(existing.map((c) => [c.id, c]))
  const byName = new Map(existing.map((c) => [c.name, c]))

  for (const c of classes) {
    const uuidMatch = byId.get(c.id)
    if (uuidMatch) {
      map.set(c.id, uuidMatch.id)
      continue
    }
    const nameMatch = byName.get(c.name)
    if (nameMatch) {
      map.set(c.id, nameMatch.id)
      continue
    }
    if (!options.allowCreate) {
      warnings.push(`学級「${c.name}」が見つからないためスキップしました`)
      continue
    }
    const uniqueName = await generateUniqueClassName(tx, c.name)
    const created = await tx.classroom.create({
      data: {
        id: c.id,
        name: uniqueName,
        classCode: c.classCode,
        grade: c.grade,
        description: c.description,
        isVisible: c.isVisible,
      },
    })
    map.set(c.id, created.id)
  }

  return { map, warnings }
}

/**
 * タグを解決する。UUID → タグ名で照合し、無ければ作成（name は unique）。
 * 返り値は archiveTagId → 実 tagId のマップ。
 */
export async function resolveTags(
  tx: TransactionClient,
  tags: ArchiveCwTag[]
): Promise<IdMap> {
  const map: IdMap = new Map()
  for (const t of tags) {
    const byId = await tx.tag.findUnique({ where: { id: t.id } })
    if (byId) {
      map.set(t.id, byId.id)
      continue
    }
    const tag = await tx.tag.upsert({
      where: { name: t.name },
      create: { name: t.name, order: t.order, color: t.color },
      update: {},
    })
    map.set(t.id, tag.id)
  }
  return map
}

/**
 * 新規作成された生徒の名簿（membership）を復元する。
 * 既存 membership がある (studentId, classroomId) はスキップ（冪等）。
 * lookup-only（allowCreate=false）では呼ばない想定。
 */
export async function restoreMemberships(
  tx: TransactionClient,
  memberships: ArchiveCwMembership[],
  studentMap: IdMap,
  classMap: IdMap
): Promise<void> {
  for (const m of memberships) {
    const studentId = studentMap.get(m.studentId)
    const classroomId = classMap.get(m.classroomId)
    if (!studentId || !classroomId) continue
    const exists = await tx.studentClassMembership.findFirst({
      where: { studentId, classroomId },
      select: { id: true },
    })
    if (exists) continue
    await tx.studentClassMembership.create({
      data: {
        studentId,
        classroomId,
        startDate: new Date(m.startDate),
        endDate: m.endDate ? new Date(m.endDate) : null,
        attendanceNumber: m.attendanceNumber,
        notes: m.notes,
      },
    })
  }
}
