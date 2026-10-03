import { auditLogListKey } from "./auditLog"
import { defineMutation } from "./defineMutation"
import { classroomListQuery, studentListQuery } from "./student"
import { tagListQuery } from "./tag"

/**
 * 試験アーカイブ（`.score`）と生徒アーカイブの書き出し・取り込み。
 *
 * 書き出しと下見は DB を変えないが、取り込みの実行は書く。
 *
 * 対応する preload は `electron-src/preload-apis/archiveApi.ts`。
 *
 * **取り込みの下見はそのまま関数として出す。** ウィザードは段ごとに結果を自分の
 * 状態へ持ち、失敗もその場（モーダルの中）に出す。書き込みの宣言（`meta`）を
 * 与えると取り直す先が無いのに失敗トーストが二重に出るので、DB を触らない下見は
 * 関数のままにする（`misc.ts` の `checkFileExists` と同じ扱い）。
 */

export const exportExamArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.archive.exportExam>[0]
    ) => window.electronAPI.archive.exportExam(input),
    meta: {
      // 書き出したことは監査ログに残る＝DB を1行書く
      invalidates: [auditLogListKey],
      errorMessage: "試験を書き出せませんでした",
    },
  })

export const bulkExportExamsMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.archive.bulkExportExams>[0]
    ) => window.electronAPI.archive.bulkExportExams(input),
    meta: {
      // 書き出したことは監査ログに残る＝DB を1行書く
      invalidates: [auditLogListKey],
      errorMessage: "試験を書き出せませんでした",
    },
  })

export const exportStudentArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.studentArchive.exportStudents
      >[0]
    ) => window.electronAPI.studentArchive.exportStudents(input),
    meta: {
      // 書き出したことは監査ログに残る＝DB を1行書く
      invalidates: [auditLogListKey],
      errorMessage: "生徒を書き出せませんでした",
    },
  })

// =====================================================================
// 取り込みの下見（DB は変わらない）
// =====================================================================

/** 取り込むファイルを尋ねるダイアログ */
export const selectExamArchiveFile = () =>
  window.electronAPI.archive.selectImportFile()

/** アーカイブの manifest を読む */
export const analyzeExamArchive = (archivePath: string) =>
  window.electronAPI.archive.analyzeArchive({ archivePath })

/** 取り込む前に、既にある実体との突き合わせを見る */
export const preMatchExamArchive = (archivePath: string) =>
  window.electronAPI.archive.preMatch({ archivePath })

/** 旧形式（.hsz）を .score へ直す */
export const convertHszToScore = (hszPath: string) =>
  window.electronAPI.archive.convertHszToScore({ hszPath })

/** 旧形式（.dat）を .score へ直す */
export const convertDatToScore = (datPath: string) =>
  window.electronAPI.archive.convertDatToScore({ datPath })

/** 採点の食い違いを、統合の決め方を踏まえて数える */
export const detectExamScoringConflicts = (
  input: Parameters<typeof window.electronAPI.archive.detectScoringConflicts>[0]
) => window.electronAPI.archive.detectScoringConflicts(input)

/** 生徒アーカイブ: 取り込むファイルを尋ねるダイアログ */
export const selectStudentArchiveFile = () =>
  window.electronAPI.studentArchive.selectImportFile()

/** 生徒アーカイブ: manifest を読む */
export const analyzeStudentArchive = (archivePath: string) =>
  window.electronAPI.studentArchive.analyzeArchive({ archivePath })

/** 生徒アーカイブ: 取り込む前の突き合わせ */
export const preMatchStudentArchive = (archivePath: string) =>
  window.electronAPI.studentArchive.preMatch({ archivePath })

// =====================================================================
// 取り込みの実行（DB を書く）
// =====================================================================

/**
 * 試験を1つ取り込む。
 *
 * 入るのは試験だけではない（生徒・学級・タグ・小計点まで作られる）ので、
 * 取り直す先も試験のまとまりだけでは足りない。
 */
export const importExamArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.archive.idIntegrationImport
      >[0]
    ) => window.electronAPI.archive.idIntegrationImport(input),
    meta: {
      invalidates: [
        ["exam"],
        studentListQuery().queryKey,
        classroomListQuery().queryKey,
        tagListQuery().queryKey,
      ],
      errorMessage: "試験を取り込めませんでした",
    },
  })

/** 生徒を取り込む（学級と在籍も作られる） */
export const importStudentArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.studentArchive.import>[0]
    ) => window.electronAPI.studentArchive.import(input),
    meta: {
      invalidates: [studentListQuery().queryKey, classroomListQuery().queryKey],
      errorMessage: "生徒を取り込めませんでした",
    },
  })
