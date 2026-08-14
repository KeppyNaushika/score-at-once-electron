import { defineMutation } from "./defineMutation"

/**
 * 試験アーカイブ（`.score`）と生徒アーカイブの書き出し・取り込み。
 *
 * 書き出しと下見は DB を変えないが、取り込みの実行は書く。
 *
 * 対応する preload は `electron-src/preload-apis/archiveApi.ts`。
 */

export const exportExamArchiveMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.archive.exportExam>[0]
    ) => window.electronAPI.archive.exportExam(input),
    meta: {
      writesDatabase: false,
      errorMessage: "試験を書き出せませんでした",
    },
  })

export const bulkExportExamsMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.archive.bulkExportExams>[0]
    ) => window.electronAPI.archive.bulkExportExams(input),
    meta: {
      writesDatabase: false,
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
      writesDatabase: false,
      errorMessage: "生徒を書き出せませんでした",
    },
  })
