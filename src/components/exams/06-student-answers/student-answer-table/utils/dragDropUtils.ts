import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  PlacementStrategy,
  UnifiedFile,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/** FileState配列と配置戦略からDnD用の順序付きファイル配列を構築する */
export function buildDnDArrayFromFileStates(
  fileStates: FileState[],
  strategy: PlacementStrategy,
  students: ExamStudentWithMemberships[],
  masterImageCount: number,
  files: UnifiedFile[]
): UnifiedFile[] {
  if (!students || !masterImageCount || fileStates.length === 0) return []

  // 生徒のソート（受験生徒順：customOrder準拠）
  const sortedStudents = [...students].sort((studentA, studentB) => {
    const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
    const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
    return studentAOrder - studentBOrder
  })

  // 配置戦略に基づいて論理位置の順序を決定（Math.floor不使用）
  const orderedPositions: Array<{
    studentId: string | null
    pageNumber: number
  }> = []

  if (strategy === "student-first") {
    // 生徒順: s1p1, s1p2, s2p1, s2p2, ...
    sortedStudents.forEach((student) => {
      for (let pageNum = 1; pageNum <= masterImageCount; pageNum++) {
        orderedPositions.push({
          studentId: student.studentId,
          pageNumber: pageNum,
        })
      }
    })
  } else {
    // ページ順: s1p1, s2p1, s3p1, ..., s1p2, s2p2, s3p2, ...
    for (let pageNum = 1; pageNum <= masterImageCount; pageNum++) {
      sortedStudents.forEach((student) => {
        orderedPositions.push({
          studentId: student.studentId,
          pageNumber: pageNum,
        })
      })
    }
  }

  // 論理位置の順序に基づいてファイルを配置
  const orderedFiles: UnifiedFile[] = []

  orderedPositions.forEach((position) => {
    // 3つ組から対応するファイルを検索
    const matchingFileState = fileStates.find(
      (state) =>
        state.studentId === position.studentId &&
        state.pageNumber === position.pageNumber
    )

    if (matchingFileState) {
      // 元のfiles配列から実際のUnifiedFileオブジェクトを取得
      const actualFile = files.find(
        (file) => file.id === matchingFileState.fileId
      )
      if (actualFile) {
        orderedFiles.push(actualFile)
      }
    }
  })

  return orderedFiles
}

/**
 * view 方式B のセル droppable ID を (studentId, pageNumber) から生成する。
 * studentId は uuid（コロンを含まない）前提。ファイルID（uuid）と衝突しないよう
 * `cell:` 接頭辞で名前空間を分ける。
 */
export function encodeCellDroppableId(
  studentId: string,
  pageNumber: number
): string {
  return `cell:${studentId}:${pageNumber}`
}

/** セル droppable ID を (studentId, pageNumber) に復号する。cell: 接頭辞でなければ null */
export function decodeCellDroppableId(
  droppableId: string
): { studentId: string; pageNumber: number } | null {
  const prefix = "cell:"
  if (!droppableId.startsWith(prefix)) return null
  const rest = droppableId.slice(prefix.length)
  const lastColon = rest.lastIndexOf(":")
  if (lastColon <= 0) return null
  const studentId = rest.slice(0, lastColon)
  const pageText = rest.slice(lastColon + 1)
  const pageNumber = Number(pageText)
  // ページ番号は1始まり。空文字（Number("")→0）や小数・非数は不正。
  if (!studentId || pageText === "" || !Number.isInteger(pageNumber)) {
    return null
  }
  if (pageNumber < 1) return null
  return { studentId, pageNumber }
}

/**
 * view 方式B: ドラッグした答案を対象セル (studentId, pageNumber) へ配置する。
 * 対象セルに別の答案が既にある場合は 2 セルの座標を入れ替える（swap）。
 * 採点データの追従/破棄は後段の確認モーダル（PlacementScorePolicy）で解決するため、
 * ここでは座標だけを更新する（新しい配列を返す。変更が無ければ元の配列を返す）。
 */
export function applyCellMoveOrSwap(
  files: UnifiedFile[],
  activeFileId: string,
  target: { studentId: string; pageNumber: number },
  // 占有判定を「表に見えている答案」に限定するための任意フィルタ。
  // trash 等で非表示の答案を隠れて swap しないため（view は無効ファイル無しだが防御的に受ける）。
  occupantEligibleIds?: Set<string>
): UnifiedFile[] {
  const activeFile = files.find((file) => file.id === activeFileId)
  if (!activeFile) return files

  const sourceStudentId = activeFile.studentId
  const sourcePageNumber = activeFile.pageNumber

  // 同一セルへのドロップは変更なし
  if (
    sourceStudentId === target.studentId &&
    sourcePageNumber === target.pageNumber
  ) {
    return files
  }

  const occupant = files.find(
    (file) =>
      file.id !== activeFileId &&
      file.studentId === target.studentId &&
      file.pageNumber === target.pageNumber &&
      (occupantEligibleIds ? occupantEligibleIds.has(file.id) : true)
  )

  return files.map((file) => {
    if (file.id === activeFileId) {
      return {
        ...file,
        studentId: target.studentId,
        pageNumber: target.pageNumber,
      }
    }
    if (occupant && file.id === occupant.id) {
      // 空セルへの移動なら occupant は無く、この分岐は通らない。
      // 占有セルなら元の答案を移動元へ入れ替える。
      return {
        ...file,
        studentId: sourceStudentId,
        pageNumber: sourcePageNumber,
      }
    }
    return file
  })
}

/** DB 上の答案の基準座標（(studentId, pageNumber)）。view 方式B の差分基準。 */
export interface AnswerCellBaseline {
  id: string
  studentId: string | null
  pageNumber: number
}

/**
 * view 方式B: 現在のファイル配置（working copy）を DB baseline と突き合わせ、
 * 座標が変わったファイルだけを PendingChange 生成用の差分（fromState=DB / toState=現在）で返す。
 *
 * 可変 ref（initialFileStatesRef）に依存せず毎回 DB 真実から算出するため、
 * 複数回ドラッグ・反映後の再読込でも累積差分が常に正しい（親は全置換して安全）。
 * baseline に無い id（新規・除籍等）は対象外。
 */
export function diffFilesAgainstBaseline(
  files: UnifiedFile[],
  baseline: AnswerCellBaseline[]
): Array<{ fileId: string; fromState: FileState; toState: FileState }> {
  const baselineById = new Map(baseline.map((cell) => [cell.id, cell]))
  const changedFiles: Array<{
    fileId: string
    fromState: FileState
    toState: FileState
  }> = []

  for (const file of files) {
    const base = baselineById.get(file.id)
    if (!base) continue
    const currentStudentId = file.studentId ?? null
    if (
      base.studentId !== currentStudentId ||
      base.pageNumber !== file.pageNumber
    ) {
      changedFiles.push({
        fileId: file.id,
        fromState: {
          fileId: file.id,
          studentId: base.studentId,
          pageNumber: base.pageNumber,
        },
        toState: {
          fileId: file.id,
          studentId: currentStudentId,
          pageNumber: file.pageNumber,
        },
      })
    }
  }

  return changedFiles
}

/** DnD後のファイル配列からFileState（ファイルID・生徒ID・ページ番号の組）を再生成する */
export function updateFileStatesFromDnDArray(
  dndArray: UnifiedFile[]
): FileState[] {
  // ファイルの実データをそのまま使用（推測ではない）
  return dndArray.map((file) => ({
    fileId: file.id,
    studentId: file.studentId || null, // ファイルの実データ
    pageNumber: file.pageNumber, // ファイルの実データ
  }))
}

/** 初期状態と現在状態を比較し、生徒IDまたはページ番号が変更されたファイルを返す */
export function compareFileStates(
  initialStates: FileState[],
  currentStates: FileState[]
) {
  const changedFiles: Array<{
    fileId: string
    fromState: FileState
    toState: FileState
  }> = []

  // 各ファイルについて、初期状態と現在状態を比較
  currentStates.forEach((currentState) => {
    const initialState = initialStates.find(
      (state) => state.fileId === currentState.fileId
    )

    if (initialState) {
      // studentId または pageNumber が変わった場合
      if (
        initialState.studentId !== currentState.studentId ||
        initialState.pageNumber !== currentState.pageNumber
      ) {
        changedFiles.push({
          fileId: currentState.fileId,
          fromState: initialState,
          toState: currentState,
        })
      }
    }
  })

  return changedFiles
}
