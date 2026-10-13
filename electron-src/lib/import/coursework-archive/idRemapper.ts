/**
 * 試験外成績資料アーカイブの外部参照（生徒・学級・タグ）ID 解決
 *
 * exam-archive と同じ「id 一次 + 名前マッチング（付加）」モデル:
 *   生徒  = id → 学籍番号 → 氏名
 *   学級  = id → 学級名
 *   タグ  = id → タグ名（Tag.name は unique）
 *
 * **id が一致すれば同じ行**で、取り込みの規則（importValuePolicy）に従って値を書く。
 * 番号・名前で結ぶのは id で一致しなかった行だけで、そのときも値を書く。名前で結ぶ候補からは、
 * アーカイブの別の行が id で取った既存の行を除く（改番・改名した行と、その旧い値を持つ別の
 * 行を1つに結ばない）。
 *
 * allowCreate=true（単体インポート）では未一致をアーカイブの値のまま新規作成する。
 * allowCreate=false（grade-archive 内包）では既存 lookup のみ、未一致はスキップ。
 */

import type { Prisma } from "@prisma/client"

import type {
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CourseworkMatchingMethod,
} from "../../../../src/types/courseworkArchive.types"
import {
  describeAmbiguity,
  describeClassroom,
  describeStudent,
  groupByHumanKey,
} from "../humanKeyMatching"
import type { ImportValuePolicy } from "../merge/importValuePolicy"
import { archiveRowReplacedAt, isUuid } from "../shared/idFirstRow"

/** アーカイブ内 UUID → 実 DB ID のマッピング */
type IdMap = Map<string, string>

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
  tx: Prisma.TransactionClient,
  students: ArchiveCwStudent[],
  options: {
    method: CourseworkMatchingMethod
    allowCreate: boolean
    policy: ImportValuePolicy
  }
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
  // 別のアーカイブの生徒が id で取った既存の生徒は候補にしない
  const archiveStudentIds = new Set(students.map((student) => student.id))
  const claimable = existing.filter(
    (existingStudent) => !archiveStudentIds.has(existingStudent.id)
  )
  const byNumber = groupByHumanKey(
    claimable,
    (existingStudent) => existingStudent.studentNumber
  )
  const byName = groupByHumanKey(
    claimable,
    (existingStudent) =>
      `${existingStudent.lastName}|${existingStudent.firstName}`
  )
  /** この取り込みで結んだ既存の生徒（1つの既存の生徒に結ぶのは1人だけ） */
  const claimedIds = new Set<string>()

  /** 同じ生徒だと決まった既存の行へ、規則に従って値を書く */
  const linkStudent = async (
    student: ArchiveCwStudent,
    existingStudent: (typeof existing)[number]
  ): Promise<void> => {
    map.set(student.id, existingStudent.id)
    claimedIds.add(existingStudent.id)
    const updatedAt = archiveRowReplacedAt(
      options.policy,
      student.updatedAt,
      existingStudent.updatedAt
    )
    if (!updatedAt) return
    // 旧 .grade（v1.12.0 以前）は氏名を持たない。無い値で既存の氏名を消さない
    const hasName = Boolean(student.lastName || student.firstName)
    await tx.student.update({
      where: { id: existingStudent.id },
      data: {
        studentNumber: student.studentNumber,
        ...(hasName
          ? {
              lastName: student.lastName,
              firstName: student.firstName,
              lastNameKana: student.lastNameKana,
              firstNameKana: student.firstNameKana,
              enrollmentYear: student.enrollmentYear,
            }
          : {}),
        updatedAt,
      },
    })
  }

  for (const student of students) {
    // 1. id 一次照合（id が一致すれば同じ生徒）
    const uuidMatch = byId.get(student.id)
    if (uuidMatch) {
      await linkStudent(student, uuidMatch)
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
    const unclaimed = candidates.filter(
      (candidate) => !claimedIds.has(candidate.id)
    )
    const matched = unclaimed[0]
    if (matched) {
      const ambiguity = describeAmbiguity(
        matchedKeyLabel,
        unclaimed.length,
        describeStudent(matched)
      )
      if (ambiguity) warnings.push(ambiguity)
      await linkStudent(student, matched)
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
    const created = await tx.student.create({
      data: {
        // 合成された非 uuid の id（旧 .grade 由来の `legacy-student:…`）を主キーへ
        // 持ち込まない。持ち込むと id は原則 uuid という規約を破ったまま
        // 以後のアーカイブと同期へ伝播する
        ...(isUuid(student.id) ? { id: student.id } : {}),
        studentNumber: student.studentNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        lastNameKana: student.lastNameKana,
        firstNameKana: student.firstNameKana,
        enrollmentYear: student.enrollmentYear,
        ...options.policy.createdTimestamps(student),
      },
    })
    map.set(student.id, created.id)
    createdIds.add(created.id)
  }

  return { map, createdIds, warnings }
}

/** 学級を解決する。返り値は archiveClassroomId → 実 classroomId のマップ。 */
export async function resolveClassrooms(
  tx: Prisma.TransactionClient,
  classes: ArchiveCwClass[],
  options: { allowCreate: boolean; policy: ImportValuePolicy }
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
  // 学級名は unique ではないので、名前で引くと複数当たりうる（生徒と同じ扱い）。
  // 別のアーカイブの学級が id で取った既存の学級は候補にしない
  const archiveClassroomIds = new Set(classes.map((classroom) => classroom.id))
  const byName = groupByHumanKey(
    existing.filter(
      (existingClassroom) => !archiveClassroomIds.has(existingClassroom.id)
    ),
    (existingClassroom) => existingClassroom.name
  )
  const claimedIds = new Set<string>()

  /**
   * 同じ学級だと決まった既存の行へ値を書く。旧形式の学級は時刻を持たないので、
   * 統合では書かず、上書きのときだけ書く（archiveRowReplacedAt）
   */
  const linkClassroom = async (
    classroom: ArchiveCwClass,
    existingClassroom: (typeof existing)[number]
  ): Promise<void> => {
    map.set(classroom.id, existingClassroom.id)
    claimedIds.add(existingClassroom.id)
    const updatedAt = archiveRowReplacedAt(
      options.policy,
      null,
      existingClassroom.updatedAt
    )
    if (!updatedAt) return
    await tx.classroom.update({
      where: { id: existingClassroom.id },
      data: {
        name: classroom.name,
        classroomCode: classroom.classroomCode,
        grade: classroom.grade,
        description: classroom.description,
        isVisible: classroom.isVisible,
        updatedAt,
      },
    })
  }

  for (const classroom of classes) {
    const uuidMatch = byId.get(classroom.id)
    if (uuidMatch) {
      await linkClassroom(classroom, uuidMatch)
      continue
    }
    const nameCandidates = (byName.get(classroom.name) ?? []).filter(
      (candidate) => !claimedIds.has(candidate.id)
    )
    const nameMatch = nameCandidates[0]
    if (nameMatch) {
      const ambiguity = describeAmbiguity(
        `学級名「${classroom.name}」`,
        nameCandidates.length,
        describeClassroom(nameMatch)
      )
      if (ambiguity) warnings.push(ambiguity)
      await linkClassroom(classroom, nameMatch)
      continue
    }
    if (!options.allowCreate) {
      warnings.push(
        `学級「${classroom.name}」が見つからないためスキップしました`
      )
      continue
    }
    const created = await tx.classroom.create({
      data: {
        // 生徒と同じく、合成された非 uuid の id は主キーへ持ち込まない
        ...(isUuid(classroom.id) ? { id: classroom.id } : {}),
        name: classroom.name,
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
 * タグを解決する。id → タグ名で照合し、無ければアーカイブの id で作る（name は unique）。
 * 返り値は archiveTagId → 実 tagId のマップ。
 *
 * 旧形式のタグは時刻を持たないので、既存のタグの値は上書きのときだけ書く。名前を書くと
 * 別のタグと重なるなら、名前は変えない。
 */
export async function resolveTags(
  tx: Prisma.TransactionClient,
  tags: ArchiveCwTag[],
  policy: ImportValuePolicy
): Promise<IdMap> {
  const map: IdMap = new Map()
  const linkTag = async (
    archiveTag: ArchiveCwTag,
    existingTag: { id: string; name: string; updatedAt: Date }
  ): Promise<void> => {
    map.set(archiveTag.id, existingTag.id)
    const updatedAt = archiveRowReplacedAt(policy, null, existingTag.updatedAt)
    if (!updatedAt) return
    const nameTaken =
      existingTag.name !== archiveTag.name &&
      (await tx.tag.findUnique({ where: { name: archiveTag.name } })) !== null
    await tx.tag.update({
      where: { id: existingTag.id },
      data: {
        ...(nameTaken ? {} : { name: archiveTag.name }),
        order: archiveTag.order,
        color: archiveTag.color,
        updatedAt,
      },
    })
  }

  // id で一致したタグを先に書く（改名で手放した名前を、同じ名前の別のタグが使えるように）
  const unmatchedTags: ArchiveCwTag[] = []
  for (const archiveTag of tags) {
    const byId = isUuid(archiveTag.id)
      ? await tx.tag.findUnique({ where: { id: archiveTag.id } })
      : null
    if (byId) {
      await linkTag(archiveTag, byId)
    } else {
      unmatchedTags.push(archiveTag)
    }
  }
  for (const archiveTag of unmatchedTags) {
    const byName = await tx.tag.findUnique({ where: { name: archiveTag.name } })
    if (byName) {
      await linkTag(archiveTag, byName)
      continue
    }
    const created = await tx.tag.create({
      data: {
        ...(isUuid(archiveTag.id) ? { id: archiveTag.id } : {}),
        name: archiveTag.name,
        order: archiveTag.order,
        color: archiveTag.color,
      },
    })
    map.set(archiveTag.id, created.id)
  }
  return map
}

/**
 * 学級所属を復元する。
 *
 * **id が一致すれば同じ所属**で、旧形式の所属は時刻を持たないので上書きのときだけ値を書く。
 * id で一致しない所属は、新規作成された生徒のものだけを作る（同じ生徒・学級・開始日の所属が
 * 既にあればそれに寄せる）。lookup-only（allowCreate=false）では呼ばない想定。
 *
 * **既存生徒には新しい所属を足さない。** 取り込み先で別学級へ異動済みの生徒に旧学級の在籍行を
 * 足してしまうと、成績だけでなく試験の学級別集計・受験日スナップショット・学級からの
 * 一括追加の母集団まで、取り込みと無関係なところが変わる。
 */
export async function restoreMemberships(
  tx: Prisma.TransactionClient,
  memberships: ArchiveCwMembership[],
  studentMap: IdMap,
  classroomMap: IdMap,
  createdStudentIds: Set<string>,
  policy: ImportValuePolicy
): Promise<void> {
  for (const membership of memberships) {
    const studentId = studentMap.get(membership.studentId)
    const classroomId = classroomMap.get(membership.classroomId)
    if (!studentId || !classroomId) continue
    const values = {
      studentId,
      classroomId,
      startDate: new Date(membership.startDate),
      endDate: membership.endDate ? new Date(membership.endDate) : null,
      attendanceNumber: membership.attendanceNumber,
      notes: membership.notes,
    }

    const byId = isUuid(membership.id)
      ? await tx.studentClassroomMembership.findUnique({
          where: { id: membership.id },
        })
      : null
    if (byId) {
      const updatedAt = archiveRowReplacedAt(policy, null, byId.updatedAt)
      if (updatedAt) {
        await tx.studentClassroomMembership.update({
          where: { id: byId.id },
          data: { ...values, updatedAt },
        })
      }
      continue
    }

    if (!createdStudentIds.has(studentId)) continue
    const sameMembership = await tx.studentClassroomMembership.findFirst({
      where: { studentId, classroomId, startDate: values.startDate },
    })
    if (sameMembership) continue
    await tx.studentClassroomMembership.create({
      data: {
        ...(isUuid(membership.id) ? { id: membership.id } : {}),
        ...values,
      },
    })
  }
}
