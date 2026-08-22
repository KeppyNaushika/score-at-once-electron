/**
 * 人が打つ値（学級名・学籍番号・利用者名）で既存の行を引くときの決まりごと。
 *
 * この3つは 2026-08-22 に `@unique` を外した（`20260822140000_drop_human_name_uniques`）。
 * 同期が「別のものが偶然ぶつかった」行を畳んでしまうのを止めるためで、代わりに
 * **同じ名前の行が2つ並ぶことが正常な状態になった**。
 *
 * 取り込みが名前で既存を探すとき、当たったのが1件とは限らない。どれに結び付けるかは
 * 値からは決まらないので、ここで2つのことを決める:
 *
 * 1. **採るのは、いちばん古い行**（`createdAt` 昇順、同時刻は `id` 昇順）。
 *    id は uuid なので、どの端末で走らせても同じ答えになる。「たまたま先に読めた行」
 *    （SQLite の格納順）で決めると、同じアーカイブを2台へ取り込んだときに違う結果になる。
 *    古い方を採るのは、アーカイブの作り手が見ていたのが先にあった行だからである。
 *
 * 2. **黙って捨てない。** 候補が2件以上あったことは、必ず数と選んだ相手を添えて
 *    呼び出し側の warning へ載せる（`describeAmbiguity`）。取り違えは静かに起きると
 *    採点や成績が別人のものになるまで気づけない。
 */

/** 人が打つ値で引ける行の最小の形（Prisma の行はこれを満たす） */
interface HumanKeyedRow {
  id: string
  createdAt: Date
}

/**
 * 行を人が打つ値でまとめる。値が同じ行は1つの配列に入り、
 * 各配列は「いちばん古い順」に並ぶ（先頭が採用される行）。
 */
export const groupByHumanKey = <TRow extends HumanKeyedRow>(
  rows: readonly TRow[],
  keyOf: (row: TRow) => string
): Map<string, TRow[]> => {
  const grouped = new Map<string, TRow[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const group = grouped.get(key)
    if (group) {
      group.push(row)
    } else {
      grouped.set(key, [row])
    }
  }
  for (const group of grouped.values()) {
    group.sort(compareByAgeThenId)
  }
  return grouped
}

/** 候補から採用する1行を決める（いちばん古い行。候補が空なら undefined） */
export const pickOldest = <TRow extends HumanKeyedRow>(
  candidates: readonly TRow[]
): TRow | undefined => [...candidates].sort(compareByAgeThenId)[0]

/**
 * 候補が2件以上あったときの伝え方。1件以下なら null（伝えることが無い）。
 *
 * @param keyLabel - 何で引いたか（`学級名「3年1組」` のような、利用者が読む言い回し）
 * @param candidateCount - 当たった件数
 * @param chosenLabel - 選んだ相手を利用者が見分けられる文字列
 */
export const describeAmbiguity = (
  keyLabel: string,
  candidateCount: number,
  chosenLabel: string
): string | null =>
  candidateCount > 1
    ? `${keyLabel}に当てはまる既存が${candidateCount}件あります。いちばん古い「${chosenLabel}」に結び付けました（違う場合は取り込み後に付け替えてください）`
    : null

/**
 * 照合理由（利用者が結び付け先を決める画面に出る文字列）に、候補が何件あったかを添える。
 * 1件なら理由をそのまま返す。
 */
export const describeCandidateCount = (
  reason: string,
  candidateCount: number
): string =>
  candidateCount > 1
    ? `${reason}（同じ値の既存が${candidateCount}件あります。いちばん古いものを候補にしています）`
    : reason

/**
 * 警告に出す「どの学級を選んだか」の見分け。
 * 同じ名前で当たったのだから、名前を繰り返しても見分けが付かない。
 */
export const describeClassroom = (classroom: {
  classroomCode: string | null
  createdAt: Date
}): string =>
  `学級コード ${classroom.classroomCode || "未設定"}・作成 ${formatDay(classroom.createdAt)}`

/** 警告に出す「どの生徒を選んだか」の見分け（学籍番号で当たったので氏名で示す） */
export const describeStudent = (student: {
  lastName: string
  firstName: string
  createdAt: Date
}): string =>
  `${student.lastName}${student.firstName}・作成 ${formatDay(student.createdAt)}`

/** 日付だけ（時刻は見分けの役に立たず、端末の時計差で揺れる） */
const formatDay = (moment: Date): string => moment.toISOString().slice(0, 10)

const compareByAgeThenId = <TRow extends HumanKeyedRow>(
  left: TRow,
  right: TRow
): number => {
  const ageDifference = left.createdAt.getTime() - right.createdAt.getTime()
  if (ageDifference !== 0) return ageDifference
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}
