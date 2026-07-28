import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  CellColumn,
  CellRow,
} from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type { AnswerImageIdentity } from "@/components/exams/06-student-answers/types"

/**
 * view 方式B のセル droppable ID を (受験者, ページ) から生成する。
 *
 * dnd-kit の droppable id は文字列でなければならない（技術的制約）ので、ここだけは
 * id を連結する。ただし**実体を引数に取る**ことで、呼び出し側が `examStudent.studentId`
 * のような別の id を渡せないようにする（両方 `string` なので型検査では守れないため）。
 * examStudentId・examPageId はいずれも uuid（コロンを含まない）前提。ファイルID（uuid）と
 * 衝突しないよう `cell:` 接頭辞で名前空間を分ける。
 */
export function encodeCellDroppableId(
  examStudent: CellRow,
  examPage: CellColumn
): string {
  return `cell:${examStudent.id}:${examPage.id}`
}

/** セル droppable ID を (examStudentId, examPageId) に復号する。cell: 接頭辞でなければ null */
export function decodeCellDroppableId(
  droppableId: string
): { examStudentId: string; examPageId: string } | null {
  const prefix = "cell:"
  if (!droppableId.startsWith(prefix)) return null
  const rest = droppableId.slice(prefix.length)
  const lastColon = rest.lastIndexOf(":")
  if (lastColon <= 0) return null
  const examStudentId = rest.slice(0, lastColon)
  const examPageId = rest.slice(lastColon + 1)
  if (!examStudentId || !examPageId) return null
  return { examStudentId, examPageId }
}

/**
 * view 方式B: ドラッグした答案を対象セル (examStudentId, examPageId) へ配置する。
 * 対象セルに別の答案が既にある場合は 2 セルの座標を入れ替える（swap）。
 * 採点データの追従/破棄は後段の確認モーダル（PlacementScorePolicy）で解決するため、
 * ここでは座標だけを更新する（新しい配列を返す。変更が無ければ元の配列を返す）。
 *
 * ただし移動元が「配置できない座標」（孤立答案＝除籍生徒・ページ範囲外）のときは、
 * 占有セルへの swap を拒否する（占有していた有効答案を孤立座標へ押し出して消してしまい、
 * さらに反映で除籍生徒への再配置が永続化される事故を防ぐ）。孤立答案の救済は空セルへの
 * 移動のみ許す。
 */
export function applyCellMoveOrSwap<T extends AnswerImageIdentity>(
  files: T[],
  activeFileId: string,
  target: { examStudentId: string; examPageId: string },
  // 占有判定を「表に見えている答案」に限定するための任意フィルタ。
  // trash 等で非表示の答案を隠れて swap しないため（view は無効ファイル無しだが防御的に受ける）。
  occupantEligibleIds?: Set<string>,
  // 移動元が配置可能な座標か（孤立答案なら false）。false のとき占有セルへの swap は拒否する。
  isSourcePlaceable: boolean = true
): T[] {
  const activeFile = files.find((file) => file.id === activeFileId)
  if (!activeFile) return files

  const sourceExamStudentId = activeFile.examStudentId
  const sourceExamPageId = activeFile.examPageId

  // 同一セルへのドロップは変更なし
  if (
    sourceExamStudentId === target.examStudentId &&
    sourceExamPageId === target.examPageId
  ) {
    return files
  }

  const occupant = files.find(
    (file) =>
      file.id !== activeFileId &&
      file.examStudentId === target.examStudentId &&
      file.examPageId === target.examPageId &&
      (occupantEligibleIds ? occupantEligibleIds.has(file.id) : true)
  )

  // 孤立答案（移動元が配置不能）を占有セルへ落とす swap は拒否する。
  // occupant を移動元の不正座標へ押し出してしまうため。
  if (occupant && !isSourcePlaceable) {
    return files
  }

  return files.map((file) => {
    if (file.id === activeFileId) {
      return {
        ...file,
        examStudentId: target.examStudentId,
        examPageId: target.examPageId,
      }
    }
    if (occupant && file.id === occupant.id) {
      // 空セルへの移動なら occupant は無く、この分岐は通らない。
      // 占有セルなら元の答案を移動元へ入れ替える。
      return {
        ...file,
        examStudentId: sourceExamStudentId,
        examPageId: sourceExamPageId,
      }
    }
    return file
  })
}

/**
 * view 方式B: 現在のファイル配置（working copy）を DB baseline と突き合わせ、
 * 座標が変わったファイルだけを PendingChange 生成用の差分（fromState=DB / toState=現在）で返す。
 *
 * 可変 ref（initialFileStatesRef）に依存せず毎回 DB 真実から算出するため、
 * 複数回ドラッグ・反映後の再読込でも累積差分が常に正しい（親は全置換して安全）。
 * baseline に無い id（新規・除籍等）は対象外。
 */
export function diffFilesAgainstBaseline<T extends AnswerImageIdentity>(
  files: T[],
  baseline: AnswerImageIdentity[]
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
    const currentExamStudentId = file.examStudentId ?? null
    const currentExamPageId = file.examPageId ?? null
    if (
      base.examStudentId !== currentExamStudentId ||
      base.examPageId !== currentExamPageId
    ) {
      changedFiles.push({
        fileId: file.id,
        fromState: {
          fileId: file.id,
          examStudentId: base.examStudentId,
          examPageId: base.examPageId,
        },
        toState: {
          fileId: file.id,
          examStudentId: currentExamStudentId,
          examPageId: currentExamPageId,
        },
      })
    }
  }

  return changedFiles
}
