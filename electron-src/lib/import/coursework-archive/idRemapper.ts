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
import {
  describeAmbiguity,
  describeClassroom,
  describeStudent,
  groupByHumanKey,
} from "../humanKeyMatching"

/** アーカイブ内 UUID → 実 DB ID のマッピング */
type IdMap = Map<string, string>

/**
 * uuid の形をしているか。旧アーカイブの変換で合成した id
 * （`legacy-student:S001` など）を主キーとして DB へ書き込まないための判定。
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: string): boolean => UUID_PATTERN.test(value)

/**
 * 生徒を解決する。返り値は archiveStudentId → 実 studentId のマップ。
 * 未解決（lookup-only で見つからない）生徒はマップに含めない。
 *
 * `createdIds` には**このインポートで新規作成した**生徒の実 id だけが入る。
 * 学級所属の復元は新規作成した生徒に限る必要があり（既存生徒に適用すると、
 * 取り込み先で異動済みの生徒に旧学級の在籍行を復活させてしまう）、
 * 呼び出し側が「既存に一致した生徒」と区別できるようにするため返す。
 */
export async function resolveStudents(
  tx: TransactionClient,
  students: ArchiveCwStudent[],
  options: { method: CourseworkMatchingMethod; allowCreate: boolean }
): Promise<{ map: IdMap; createdIds: Set<string>; warnings: string[] }> {
  const map: IdMap = new Map()
  const createdIds = new Set<string>()
  const warnings: string[] = []
  const existing = await tx.student.findMany()
  const byId = new Map(
    existing.map((existingStudent) => [existingStudent.id, existingStudent])
  )
  // 学籍番号も氏名も unique ではないので、どちらで引いても複数当たりうる。
  // どれを採るかは humanKeyMatching の決まり（いちばん古い行）に従い、
  // 2件以上あったことは warning で伝える（取り違えは静かに起きると気づけない）。
  const byNumber = groupByHumanKey(
    existing,
    (existingStudent) => existingStudent.studentNumber
  )
  const byName = groupByHumanKey(
    existing,
    (existingStudent) =>
      `${existingStudent.lastName}|${existingStudent.firstName}`
  )

  for (const student of students) {
    // 1. UUID 一次照合
    const uuidMatch = byId.get(student.id)
    if (uuidMatch) {
      map.set(student.id, uuidMatch.id)
      continue
    }
    // 2. 二次照合（候補は古い順に並んでいる。先頭が採用される行）
    let candidates: (typeof existing)[number][] = []
    let matchedKeyLabel = ""
    if (options.method === "studentNumber") {
      candidates = byNumber.get(student.studentNumber) ?? []
      matchedKeyLabel = `学籍番号「${student.studentNumber}」`
    } else if (options.method === "name") {
      candidates = byName.get(`${student.lastName}|${student.firstName}`) ?? []
      matchedKeyLabel = `氏名「${student.lastName}${student.firstName}」`
    }
    const matched = candidates[0]
    if (matched) {
      const ambiguity = describeAmbiguity(
        matchedKeyLabel,
        candidates.length,
        describeStudent(matched)
      )
      if (ambiguity) warnings.push(ambiguity)
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
    // 氏名を持たないレコードからは作らない。旧 .grade（v1.12.0 以前）は生徒を
    // 学籍番号だけで参照しており氏名を持ち出していないため、作ると氏名が空の生徒が
    // 名簿に並ぶ。作らずに済ませて、先に生徒を登録してもらう方が復旧できる
    if (!student.lastName && !student.firstName) {
      warnings.push(
        `生徒（${student.studentNumber}）は氏名の情報が無いため作成しませんでした。` +
          `先に生徒を登録してから取り込み直してください`
      )
      continue
    }
    const uniqueNumber = await generateUniqueStudentNumber(
      tx,
      student.studentNumber
    )
    const created = await tx.student.create({
      data: {
        // 合成された非 uuid の id（旧 .grade 由来の `legacy-student:…`）を主キーへ
        // 持ち込まない。持ち込むと id は原則 uuid という規約を破ったまま
        // 以後のアーカイブと同期へ伝播する
        ...(isUuid(student.id) ? { id: student.id } : {}),
        studentNumber: uniqueNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        lastNameKana: student.lastNameKana,
        firstNameKana: student.firstNameKana,
        enrollmentYear: student.enrollmentYear,
      },
    })
    map.set(student.id, created.id)
    createdIds.add(created.id)
  }

  return { map, createdIds, warnings }
}

/** 学級を解決する。返り値は archiveClassroomId → 実 classroomId のマップ。 */
export async function resolveClassrooms(
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
  // 学級名は unique ではないので、名前で引くと複数当たりうる（生徒と同じ扱い）
  const byName = groupByHumanKey(
    existing,
    (existingClassroom) => existingClassroom.name
  )

  for (const classroom of classes) {
    const uuidMatch = byId.get(classroom.id)
    if (uuidMatch) {
      map.set(classroom.id, uuidMatch.id)
      continue
    }
    const nameCandidates = byName.get(classroom.name) ?? []
    const nameMatch = nameCandidates[0]
    if (nameMatch) {
      const ambiguity = describeAmbiguity(
        `学級名「${classroom.name}」`,
        nameCandidates.length,
        describeClassroom(nameMatch)
      )
      if (ambiguity) warnings.push(ambiguity)
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
        // 生徒と同じく、合成された非 uuid の id は主キーへ持ち込まない
        ...(isUuid(classroom.id) ? { id: classroom.id } : {}),
        name: uniqueName,
        classroomCode: classroom.classroomCode,
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
 *
 * **既存生徒には適用しない。** 取り込み先で別学級へ異動済みの生徒に旧学級の在籍行を
 * 足してしまうと、成績だけでなく試験の学級別集計・受験日スナップショット・学級からの
 * 一括追加の母集団まで、取り込みと無関係なところが変わる。
 */
export async function restoreMemberships(
  tx: TransactionClient,
  memberships: ArchiveCwMembership[],
  studentMap: IdMap,
  classroomMap: IdMap,
  createdStudentIds: Set<string>
): Promise<void> {
  for (const membership of memberships) {
    const studentId = studentMap.get(membership.studentId)
    const classroomId = classroomMap.get(membership.classroomId)
    if (!studentId || !classroomId) continue
    if (!createdStudentIds.has(studentId)) continue
    const exists = await tx.studentClassroomMembership.findFirst({
      where: { studentId, classroomId },
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
