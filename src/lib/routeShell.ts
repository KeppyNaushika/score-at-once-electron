/**
 * 動的ルートは、仮の値 `"__"` の殻を1枚だけビルド時に作り、実際の URL（`/exams/<id>/…`）を
 * その殻（`/exams/__/…`）へ書き換えて配る。
 *
 * 画面は静的書き出し（`output: "export"`）で作り、デスクトップ版も web 版も同じ書き出しを
 * 配る。試験や生徒の id は利用者の DB にしか無く、ビルドの時点では分からないので、動的
 * ルートは殻だけを作り（`generateStaticParams`）、殻以外は描かない（`dynamicParams = false`）。
 * 中身のデータは画面が URL の id で取りに行くので、殻1枚でどの id も描ける。
 *
 * 書き換えるのは次の3か所で、どれも `toRouteShellPath` を使う。
 * - デスクトップ版: main の配信（`electron-src/rendererStaticServer.ts`）
 * - 開発用サーバー: `next.config.ts` の `rewrites`
 * - web 版: 配信側
 *
 * 画面は param を `useParams` ではなく URL から読む（`useRouteParams`）ので、殻の値では
 * なく実際の id で動く。
 */

/**
 * 動的ルートの param 名を、URL の第1セグメント（`src/app/(app)/<section>/[param]/`）
 * から引く表。**動的ルートの定義はここ1か所だけ。** `src/app` に動的セグメントを
 * 足したら、ここにも足す（入れ子の動的セグメント・catch-all は今は無い。一致は規約
 * テスト `routeShell` が縛る）。
 */
export const ROUTE_PARAM_NAMES = {
  exams: "examId",
  grades: "gradeId",
  coursework: "courseworkId",
  students: "studentId",
  classrooms: "classroomId",
  "answer-sheet-builder": "definitionId",
} as const

export type RouteSection = keyof typeof ROUTE_PARAM_NAMES

/** 動的ルートの param 名 */
export type RouteParamName = (typeof ROUTE_PARAM_NAMES)[RouteSection]

/** 殻に使う仮の値。実際の id（uuid）と重ならない */
export const ROUTE_SHELL_PARAM = "__"

export function isRouteSection(section: string): section is RouteSection {
  return Object.hasOwn(ROUTE_PARAM_NAMES, section)
}

/** 動的ルートの layout の `generateStaticParams`。殻を1枚だけ作る */
export function routeShellParams(
  paramName: RouteParamName
): Record<string, string>[] {
  return [{ [paramName]: ROUTE_SHELL_PARAM }]
}

/**
 * Next が書き出す、画面移動用のファイルの名前の頭（`/exams/__next._tree.txt` など）。
 * 一覧（`/exams`）のものは id と同じ位置に来るので、id と取り違えない
 */
const NEXT_SEGMENT_FILE_PREFIX = "__next."

/**
 * 実際の URL のパスを、ビルド時に作った殻のパスへ書き換える。動的ルートの外のパスは
 * そのまま返す。
 *
 * 例: `/exams/<id>/07-score-at-once` → `/exams/__/07-score-at-once`
 */
export function toRouteShellPath(pathname: string): string {
  const [, section, param, ...rest] = pathname.split("/")
  if (section === undefined || param === undefined || param === "") {
    return pathname
  }
  if (!isRouteSection(section)) return pathname
  if (param.startsWith(NEXT_SEGMENT_FILE_PREFIX)) return pathname
  return ["", section, ROUTE_SHELL_PARAM, ...rest].join("/")
}
