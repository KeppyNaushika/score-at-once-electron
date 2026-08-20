import { queryOptions } from "@tanstack/react-query"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"
import type {
  GradeCellTarget,
  GradeConstraintInput,
  GradeDataSourceInput,
  GradeOverrideInput,
} from "@/types/grade.types"
import type { GradeReportSettings } from "@/types/gradeReport.types"

import { auditLogListKey } from "./auditLog"
import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 成績算出（Grade）の読み書き。
 *
 * `window.electronAPI` を書いてよいのは `src/queries/**` だけ。キーと呼び出しが
 * ここで1つに結びつくので、同じデータが別のキーで2度キャッシュされることが起きない。
 *
 * 対応する preload は `electron-src/preload-apis/gradeApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 成績算出の一覧 */
export const gradeListQuery = () =>
  queryOptions({
    queryKey: ["grade", "list"] as const,
    queryFn: () => window.electronAPI.grade.getAll(),
  })

/**
 * 成績本体。評価項目・データソース・境界を子として同梱して1回で取る。
 * 03（データソース）・05（境界）・07（出力）が同じキーで共有する。
 */
export const gradeDetailQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "detail"] as const,
    queryFn: () => window.electronAPI.grade.getById(gradeId),
  })

/** その成績の対象者1件（生徒と所属を同梱） */
export type GradeStudentRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getStudents>
>[number]

/** その成績の対象者（GradeStudent） */
export const gradeStudentsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "students"] as const,
    queryFn: () => window.electronAPI.grade.getStudents(gradeId),
  })

/** その成績に紐づく学級1件 */
export type GradeClassroomRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getClassrooms>
>[number]

/** その成績に紐づく学級 */
export const gradeClassroomsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "classrooms"] as const,
    queryFn: () => window.electronAPI.grade.getClassrooms(gradeId),
  })

/** まだ追加していない学級 */
export const gradeAvailableClassroomsQuery = (
  gradeId: string,
  activeOnly: boolean
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.grade(gradeId),
      "availableClassrooms",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.grade.getAvailableClassrooms(gradeId, activeOnly),
  })

/** まだ追加していない生徒 */
export const gradeAvailableStudentsQuery = (
  gradeId: string,
  activeOnly: boolean
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.grade(gradeId),
      "availableStudents",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.grade.getAvailableStudents(gradeId, activeOnly),
  })

/** 観点間の制約ルール */
export const gradeConstraintsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "constraints"] as const,
    queryFn: () => window.electronAPI.grade.getGradeConstraints(gradeId),
  })

/** 算出結果（評定・確定状態を含む） */
export const gradeResultsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "results"] as const,
    queryFn: () => window.electronAPI.grade.calculateGrades(gradeId),
  })

/**
 * 個人成績通知書の設定（成績算出ごとに1行）。
 *
 * **行をそのまま載せる。** まだ無ければ `null` で、既定で描くのは表示側。
 */
export const gradeReportSettingsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "reportSettings"] as const,
    queryFn: () => window.electronAPI.grade.getReportSettings(gradeId),
  })

/**
 * 欠測推定の当てはまり（相関）。
 *
 * **成績のスコープ（`["grade", gradeId]`）の外に置く。** 算出は全試験のスコア取得を
 * 伴って重く、しかも推定の設定を変えたときしか変わらない。スコープ内に置くと、
 * 名前を1文字打つたびの取り直しに巻き込まれる。
 */
export const gradeSourceFitsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: ["gradeSourceFits", gradeId] as const,
    queryFn: () => window.electronAPI.grade.computeSourceFits(gradeId),
  })

/** データソースに指定できる試験の候補 */
export const gradeExamCandidatesQuery = () =>
  queryOptions({
    queryKey: ["grade", "examCandidates"] as const,
    queryFn: () => window.electronAPI.grade.getExamCandidates(),
  })

/** ある試験の中で指定できる小計点の候補 */
export const gradeExamSubtotalGroupsQuery = (examId: string) =>
  queryOptions({
    queryKey: ["grade", "examSubtotalGroups", examId] as const,
    queryFn: () => window.electronAPI.grade.getExamSubtotalGroups(examId),
  })

/** ある試験の中で指定できる設問領域の候補 */
export const gradeExamCropRegionsQuery = (examId: string) =>
  queryOptions({
    queryKey: ["grade", "examCropRegions", examId] as const,
    queryFn: () => window.electronAPI.grade.getExamCropRegions(examId),
  })

/**
 * 除外セルの同定キー。除外の主語は「その成績の対象者」（GradeStudent）であり、
 * 人（Student）ではない。どちらも string なので、実体ではなくキーを組み立てる
 * この一箇所に集約して取り違えを防ぐ。
 */
export const buildGradeExclusionKey = (target: GradeCellTarget) =>
  `${target.gradeStudentId}:${target.gradeItemId}`

/** 除外設定1行 */
export type GradeItemExclusionRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getGradeItemExclusions>
>[number]

/** 対象者ごとの評価項目の除外設定（行のまま） */
export const gradeItemExclusionsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "exclusions"] as const,
    queryFn: () => window.electronAPI.grade.getGradeItemExclusions(gradeId),
  })

// =====================================================================
// 書き込み
// =====================================================================

/**
 * その成績に紐づくもの全部。
 *
 * 評価項目・データソース・境界・除外はどれも算出結果に効くので、1つ書けば
 * 本体も結果も古くなる。前方一致でまとめて取り直す。重い `sourceFits` は
 * この外にあるので巻き込まれない。
 */
const gradeScope = (gradeId: string) => scopeKeys.grade(gradeId)

export const createGradeMutation = () =>
  defineMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      window.electronAPI.grade.create(input),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績算出を作成できませんでした",
    },
  })

export const updateGradeMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      name?: string
      description?: string | null
      referenceDate?: string | null
    }) => window.electronAPI.grade.update(gradeId, input),
    meta: {
      invalidates: [gradeScope(gradeId), gradeListQuery().queryKey],
      errorMessage: "成績算出を保存できませんでした",
    },
  })

export const deleteGradeMutation = () =>
  defineMutation({
    mutationFn: (gradeId: string) => window.electronAPI.grade.delete(gradeId),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績算出を削除できませんでした",
    },
  })

export const duplicateGradeMutation = () =>
  defineMutation({
    mutationFn: (gradeId: string) =>
      window.electronAPI.grade.duplicate(gradeId),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績算出を複製できませんでした",
    },
  })

export const addStudentsToGradeMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.grade.addStudentsToGrade(gradeId, studentIds),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "生徒を追加できませんでした",
    },
  })

export const addStudentsFromClassroomMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { classroomId: string; activeOnly?: boolean }) =>
      window.electronAPI.grade.addStudentsFromClassroom(
        gradeId,
        input.classroomId,
        input.activeOnly
      ),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "学級を追加できませんでした",
    },
  })

export const removeGradeClassroomMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      classroomId: string
      removeStudents: boolean
      /** 利用者が確認ダイアログで見た件数（消す直前に main が数え直す。段階26） */
      confirmedCounts: ConfirmedDeletionCount[]
    }) =>
      window.electronAPI.grade.removeClassroom(
        gradeId,
        input.classroomId,
        input.removeStudents,
        input.confirmedCounts
      ),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "学級を削除できませんでした",
    },
  })

export const setGradeClassroomOrdersMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orderedClassroomIds: string[]) =>
      window.electronAPI.grade.setClassroomOrders(gradeId, orderedClassroomIds),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "学級の並び順を保存できませんでした",
    },
  })

export const updateGradeStudentOrdersMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (studentOrders: { studentId: string; customOrder: number }[]) =>
      window.electronAPI.grade.updateStudentOrders(gradeId, studentOrders),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "生徒の並び順を保存できませんでした",
    },
  })

// --- 評価項目 ---

export const createGradeItemMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (name: string) =>
      window.electronAPI.grade.createGradeItem({ gradeId, name }),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評価項目を追加できませんでした",
    },
  })

export const renameGradeItemMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { id: string; name: string }) =>
      window.electronAPI.grade.updateGradeItem(input.id, { name: input.name }),
    scope: { id: `grade:${gradeId}:items` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評価項目の名前を保存できませんでした",
    },
  })

/** 評価項目を消すと配下のデータソース（＝予測変数の集合）が減るので相関も古くなる */
export const deleteGradeItemMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (gradeItemId: string) =>
      window.electronAPI.grade.deleteGradeItem(gradeItemId),
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "評価項目を削除できませんでした",
    },
  })

export const reorderGradeItemsMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderGradeItems(orders),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評価項目の並び順を保存できませんでした",
    },
  })

// --- データソース ---

/** ソースを足すと予測変数・対象が増えるので相関も古くなる */
export const createDataSourceMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: GradeDataSourceInput) =>
      window.electronAPI.grade.createDataSource(input),
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "データソースを追加できませんでした",
    },
  })

/**
 * 名前と換算満点を変える。**相関は変わらないので取り直さない**
 * （重い再算出を打鍵のたびに走らせない）。
 */
export const renameDataSourceMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { id: string; name: string; weight: number }) =>
      window.electronAPI.grade.updateDataSource(input.id, {
        name: input.name,
        weight: input.weight,
      }),
    scope: { id: `grade:${gradeId}:dataSources` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "データソースを保存できませんでした",
    },
  })

/**
 * 欠測推定の設定を変える。予測の前提が変わるので相関も取り直す。
 *
 * **列の顔ぶれは IPC の引数から導く。** ここで手書きすると、書き写しが1つずれても
 * 型検査に掛からない（対象が全て optional なので「必須の欠落」にならず、変数で渡す
 * 限り余剰プロパティ検査も働かない）。実際それで、一括設定が常に失敗していたのに
 * `tsc` が黙っていた（docs/branch-review-findings.md #3）。
 */
export const updateDataSourceEstimationMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
    } & Parameters<typeof window.electronAPI.grade.updateDataSource>[1]) =>
      window.electronAPI.grade.updateDataSource(id, data),
    scope: { id: `grade:${gradeId}:dataSources` },
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "欠測時の設定を保存できませんでした",
    },
  })

export const deleteDataSourceMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (dataSourceId: string) =>
      window.electronAPI.grade.deleteDataSource(dataSourceId),
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "データソースを削除できませんでした",
    },
  })

export const reorderDataSourcesMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderDataSources(orders),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "データソースの並び順を保存できませんでした",
    },
  })

// --- 境界（評定の刻み） ---

/**
 * プリセットを当てる。**一括経路**（`docs/coding-style.md` の「状態を運んでよい経路」）。
 * 「この刻みにしろ」という指示そのものなので、触っていない行という概念が無い。
 */
export const applyGradeBoundaryPresetMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => window.electronAPI.grade.replaceGradeItemBoundaries(input),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の刻みを設定できませんでした",
    },
  })

export const createGradeItemBoundaryMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      gradeItemId: string
      label: string
      minPercentage: number
      order: number
    }) => window.electronAPI.grade.createGradeItemBoundary(input),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を追加できませんでした",
    },
  })

export const updateGradeItemBoundaryMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      id: string
      label?: string
      minPercentage?: number
    }) => window.electronAPI.grade.updateGradeItemBoundary(input),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を保存できませんでした",
    },
  })

export const deleteGradeItemBoundaryMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (boundaryId: string) =>
      window.electronAPI.grade.deleteGradeItemBoundary(boundaryId),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を削除できませんでした",
    },
  })

export const reorderGradeItemBoundariesMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderGradeItemBoundaries(orders),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界の並び順を保存できませんでした",
    },
  })

/** 確認ダイアログを経た「全部消す」。1本ずつの削除とは別の意図として扱う */
export const deleteAllGradeItemBoundariesMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (gradeItemId: string) =>
      window.electronAPI.grade.deleteGradeItemBoundaries(gradeItemId),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を削除できませんでした",
    },
  })

// --- 評定の上書き・確定 ---

export const upsertGradeOverrideMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: GradeOverrideInput & { overrideLabel: string }) =>
      window.electronAPI.grade.upsertGradeOverride({
        gradeStudentId: input.gradeStudentId,
        gradeItemId: input.gradeItemId,
        overrideLabel: input.overrideLabel,
      }),
    scope: { id: `grade:${gradeId}:overrides` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の上書きを保存できませんでした",
    },
  })

export const deleteGradeOverrideMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (target: GradeCellTarget) =>
      window.electronAPI.grade.deleteGradeOverride(target),
    scope: { id: `grade:${gradeId}:overrides` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の上書きを解除できませんでした",
    },
  })

export const freezeGradeScoresMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      targets?: GradeCellTarget[]
      frozenByUserId: string | null
    }) =>
      window.electronAPI.grade.freezeGradeScores({
        gradeId,
        targets: input.targets,
        frozenByUserId: input.frozenByUserId,
      }),
    scope: { id: `grade:${gradeId}:frozen` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "成績値を確定できませんでした",
    },
  })

export const unfreezeGradeScoresMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      targets?: GradeCellTarget[]
      userId: string | null
    }) =>
      window.electronAPI.grade.unfreezeGradeScores({
        gradeId,
        targets: input.targets,
        userId: input.userId,
      }),
    scope: { id: `grade:${gradeId}:frozen` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "確定を解除できませんでした",
    },
  })

// --- 制約ルール ---

export const createGradeConstraintMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (constraint: GradeConstraintInput) =>
      window.electronAPI.grade.createGradeConstraint({ gradeId, constraint }),
    meta: {
      invalidates: [gradeConstraintsQuery(gradeId).queryKey],
      errorMessage: "制約ルールを追加できませんでした",
    },
  })

export const updateGradeConstraintMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      id: string
      constraint: Partial<GradeConstraintInput>
    }) => window.electronAPI.grade.updateGradeConstraint(input),
    scope: { id: `grade:${gradeId}:constraints` },
    meta: {
      invalidates: [gradeConstraintsQuery(gradeId).queryKey],
      errorMessage: "制約ルールを保存できませんでした",
    },
  })

export const deleteGradeConstraintMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (constraintId: string) =>
      window.electronAPI.grade.deleteGradeConstraint(constraintId),
    meta: {
      invalidates: [gradeConstraintsQuery(gradeId).queryKey],
      errorMessage: "制約ルールを削除できませんでした",
    },
  })

// --- 除外 ---

/**
 * 1マスの除外を切り替える。
 *
 * **`scope` は `invalidates` と同じ単位で取る。** レコード単位にすると、格子の
 * マスごとに `useMutation` を呼ぶ必要が出る（フックはループの中で呼べないので、
 * マスごとのコンポーネントが要る）。書き込みは1ミリ秒台で端末間の競合も起きない
 * ため、まとめて直列にしても待ち時間は測れない。順序はむしろ全体で保証される。
 */
export const setGradeItemExclusionMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { target: GradeCellTarget; excluded: boolean }) =>
      window.electronAPI.grade.setGradeItemExclusion({
        ...input.target,
        excluded: input.excluded,
      }),
    scope: { id: `grade:${gradeId}:exclusions` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "対象生徒の設定を保存できませんでした",
    },
  })

// --- 出力設定 ---

/**
 * 通知書の設定を書く。**触った列だけ**を渡す。
 *
 * まるごと渡すと、続けて2つチェックを入れたときに先の1つが消える（取り直しが着地する
 * 前に、古い写しへ2度目を重ねて書くため）。この行にはヌル許容の列が無いので、
 * 載せない＝触らない、で曖昧さが無い。
 */
export const updateGradeReportSettingsMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (values: Partial<GradeReportSettings>) =>
      window.electronAPI.grade.updateReportSettings(gradeId, values),
    scope: { id: `grade:${gradeId}:reportSettings` },
    meta: {
      invalidates: [gradeReportSettingsQuery(gradeId).queryKey],
      errorMessage: "出力設定を保存できませんでした",
    },
  })

// =====================================================================
// DB を書かない操作（出力・取り込みの下見）
// =====================================================================

export const exportGradeExcelMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (
      options: Parameters<typeof window.electronAPI.grade.exportExcel>[1]
    ) => window.electronAPI.grade.exportExcel(gradeId, options),
    meta: {
      writesDatabase: false,
      errorMessage: "Excelを出力できませんでした",
    },
  })

export const exportGradeArchiveMutation = () =>
  defineMutation({
    mutationFn: (gradeId: string) =>
      window.electronAPI.grade.exportArchive(gradeId),
    meta: {
      // 書き出したことは監査ログに残る＝DB を1行書く
      invalidates: [auditLogListKey],
      errorMessage: "成績アーカイブを書き出せませんでした",
    },
  })

/** ファイルを選んで中身を読むだけ。取り込みの実行は `executeGradeImportMutation` */
export const analyzeGradeArchiveMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.grade.importArchive(),
    meta: {
      writesDatabase: false,
      errorMessage: "成績アーカイブを読み込めませんでした",
    },
  })

/** 取り込みの下見で読んだアーカイブの中身（版ごとの形はそのまま持つ） */
export type GradeArchivePayload = Extract<
  Awaited<ReturnType<typeof window.electronAPI.grade.importArchive>>,
  { canceled: false }
>["archiveData"]

export const executeGradeImportMutation = () =>
  defineMutation({
    mutationFn: (input: {
      archiveData: GradeArchivePayload
      options: Parameters<typeof window.electronAPI.grade.executeImport>[1]
    }) =>
      window.electronAPI.grade.executeImport(input.archiveData, input.options),
    meta: {
      invalidates: [gradeListQuery().queryKey],
      errorMessage: "成績アーカイブを取り込めませんでした",
    },
  })

/** 学級を外したときに何が消えるかの下見。DB は変えない */
export const previewGradeClassroomRemovalMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (classroomId: string) =>
      window.electronAPI.grade.classroomRemovalPreview(gradeId, classroomId),
    meta: {
      writesDatabase: false,
      errorMessage: "学級の削除内容を確認できませんでした",
    },
  })
