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
  const byId = new Map(
    existing.map((existingStudent) => [existingStudent.id, existingStudent])
  )
  const byNumber = new Map(
    existing.map((existingStudent) => [
      existingStudent.studentNumber,
      existingStudent,
    ])
  )
  const byName = new Map<string, (typeof existing)[number]>()
  for (const existingStudent of existing) {
    const key = `${existingStudent.lastName}|${existingStudent.firstName}`
    if (!byName.has(key)) byName.set(key, existingStudent)
  }

  for (const student of students) {
    // 1. UUID 一次照合
    const uuidMatch = byId.get(student.id)
    if (uuidMatch) {
      map.set(student.id, uuidMatch.id)
      continue
    }
    // 2. 二次照合
    let matched: (typeof existing)[number] | undefined
    if (options.method === "studentNumber") {
      matched = byNumber.get(student.studentNumber)
    } else if (options.method === "name") {
      matched = byName.get(`${student.lastName}|${student.firstName}`)
    }
    if (matched) {
      map.set(student.id, matched.id)
      continue
    }
    // 3. 新規作成 or スキップ
    if (!options.allowCreate) {
      warnings.push(
        `生徒「${student.lastName}${student.firstName}（${student.studentNumber}）」が見つからないためスキップしました`
      )
      continue
    }
    const uniqueNumber = await generateUniqueStudentNumber(
      tx,
      student.studentNumber
    )
    const created = await tx.student.create({
      data: {
        id: student.id,
        studentNumber: uniqueNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        lastNameKana: student.lastNameKana,
        firstNameKana: student.firstNameKana,
        enrollmentYear: student.enrollmentYear,
      },
    })
    map.set(student.id, created.id)
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
  const byId = new Map(
    existing.map((existingClassroom) => [
      existingClassroom.id,
      existingClassroom,
    ])
  )
  const byName = new Map(
    existing.map((existingClassroom) => [
      existingClassroom.name,
      existingClassroom,
    ])
  )

  for (const classroom of classes) {
    const uuidMatch = byId.get(classroom.id)
    if (uuidMatch) {
      map.set(classroom.id, uuidMatch.id)
      continue
    }
    const nameMatch = byName.get(classroom.name)
    if (nameMatch) {
      map.set(classroom.id, nameMatch.id)
      continue
    }
    if (!options.allowCreate) {
      warnings.push(
        `学級「${classroom.name}」が見つからないためスキップしました`
      )
      continue
    }
    const uniqueName = await generateUniqueClassName(tx, classroom.name)
    const created = await tx.classroom.create({
      data: {
        id: classroom.id,
        name: uniqueName,
        classCode: classroom.classCode,
        grade: classroom.grade,
        description: classroom.description,
        isVisible: classroom.isVisible,
      },
    })
    map.set(classroom.id, created.id)
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
  for (const archiveTag of tags) {
    const byId = await tx.tag.findUnique({ where: { id: archiveTag.id } })
    if (byId) {
      map.set(archiveTag.id, byId.id)
      continue
    }
    const tag = await tx.tag.upsert({
      where: { name: archiveTag.name },
      create: {
        name: archiveTag.name,
        order: archiveTag.order,
        color: archiveTag.color,
      },
      update: {},
    })
    map.set(archiveTag.id, tag.id)
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
  for (const membership of memberships) {
    const studentId = studentMap.get(membership.studentId)
    const classroomId = classMap.get(membership.classroomId)
    if (!studentId || !classroomId) continue
    const exists = await tx.studentClassroomMembership.findFirst({
      where: { studentId, classroomId },
      select: { id: true },
    })
    if (exists) continue
    await tx.studentClassroomMembership.create({
      data: {
        studentId,
        classroomId,
        startDate: new Date(membership.startDate),
        endDate: membership.endDate ? new Date(membership.endDate) : null,
        attendanceNumber: membership.attendanceNumber,
        notes: membership.notes,
      },
    })
  }
}
