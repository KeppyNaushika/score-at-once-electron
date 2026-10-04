import type {
  OpenedUnifiedArchive,
  RejectedUnifiedArchive,
} from "@/components/unified-archive/import/types"
import type { CourseworkArchiveImportPreview } from "@/types/courseworkArchive.types"
import type { ImportWizardState } from "@/types/examArchive.types"
import type { GradeArchiveImportPreview } from "@/types/gradeArchive.types"
import type { StudentImportWizardState } from "@/types/studentArchive.types"

/**
 * 「読み込み」で選んで開いたファイル。種類ごとに開く取り込み画面と、その画面を始める
 * ものを持つ（どの画面もファイル選択の段を飛ばして始まる）
 */
export type OpenedArchiveImport =
  | {
      /** 統合アーカイブ（.sao）→ 統合版のウィザード */
      screen: "unified"
      startWith: OpenedUnifiedArchive | RejectedUnifiedArchive
    }
  | {
      /** .score・.hsz・.dat → 試験の取り込みウィザード */
      screen: "exam"
      startState: ImportWizardState
    }
  | {
      /** .coursework → 資料の取り込みダイアログ */
      screen: "coursework"
      archivePath: string
      preview: CourseworkArchiveImportPreview
    }
  | {
      /** .grade → 成績算出の取り込みダイアログ */
      screen: "grade"
      archivePath: string
      preview: GradeArchiveImportPreview
    }
  | {
      /** .students → 生徒の取り込みウィザード */
      screen: "students"
      startState: StudentImportWizardState
    }
