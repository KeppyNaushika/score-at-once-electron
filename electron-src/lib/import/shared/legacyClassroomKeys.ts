/**
 * 旧アーカイブ（学級 Class→Classroom リネーム前）の JSON キーを現行キーへ正規化する。
 *
 * - classId    → classroomId
 * - classes    → classrooms
 * - className  → classroomName
 *
 * アーカイブ JSON 内でこれらのキーは常に学級（Classroom）を指すため、
 * 一律の再帰変換で安全（CSS の className や Prisma リレーションは含まれない）。
 * 新旧キーが両方ある場合は新キーを優先し旧キーは捨てる。
 *
 * NOTE: exam アーカイブは変換器チェーンが実インポート経路に未配線のため、
 * 読取り境界で正規化する（convertScoresDataToV1_13 と同方式）。
 * 変換器チェーンの本配線は別issueで対応予定。
 */

const LEGACY_CLASSROOM_KEY_MAP: Record<string, string> = {
  classId: "classroomId",
  classes: "classrooms",
  className: "classroomName",
}

/** 旧学級キーを現行キーへ再帰的に正規化した新しい値を返す（元の値は変更しない）。 */
export function normalizeLegacyClassroomKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeLegacyClassroomKeys(item)
    ) as unknown as T
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(source)) {
      const newKey = LEGACY_CLASSROOM_KEY_MAP[key] ?? key
      // 旧キーだが新キーも既に存在する場合は新キーを優先して旧キーを捨てる
      if (newKey !== key && newKey in source) continue
      result[newKey] = normalizeLegacyClassroomKeys(val)
    }
    return result as T
  }
  return value
}
