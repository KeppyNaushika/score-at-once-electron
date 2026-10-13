/**
 * ID統合ステップの型定義
 */

import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  CategoryIdIntegrationConfig,
  ClassroomMatchingStrategy,
  ExistingItemInfo,
  IdChoice,
  IdIntegrationDecision,
  PreMatchingResult,
  StudentMatchingStrategy,
  SubtotalGroupMatchingStrategy,
} from "@/types/examArchive.types"

import type { IdIntegrationRow } from "../../idIntegrationRows"

export type CategoryType = "student" | "classroom" | "subtotalGroup" | "user"

export type EntityType = "student" | "classroom" | "subtotalGroup"

/** 決定タイプ */
export type DecisionType = "same_person" | "create_new" | "skip"

/** UIのSelect等が返す string を DecisionType へ絞り込む */
export function isDecisionType(value: string): value is DecisionType {
  return value === "same_person" || value === "create_new" || value === "skip"
}

/** エンティティごとのラベル設定 */
interface EntityLabels {
  samePerson: string
  createNew: string
  skip: string
  noData: string
  idChoiceLabel: string
  /** 紐づけ先を探す欄の案内 */
  searchPlaceholder: string
}

/** エンティティ → 行の呼び名・添え書きを作るときの表名（`src/lib/matchRowText.ts`） */
export const ENTITY_TABLES: Record<EntityType, string> = {
  student: "Student",
  classroom: "Classroom",
  subtotalGroup: "SubtotalGroup",
}

/** エンティティラベルの定義 */
export const ENTITY_LABELS: Record<EntityType, EntityLabels> = {
  student: {
    samePerson: "このPCの生徒と同じ人として扱う",
    createNew: "新しい生徒として登録する",
    skip: "取り込まない",
    noData: "このPCに同じデータなし",
    idChoiceLabel: "どちらに合わせる？",
    searchPlaceholder: "氏名・番号・読み・学級で検索",
  },
  classroom: {
    samePerson: "このPCの学級と同じものとして扱う",
    createNew: "新しい学級として登録する",
    skip: "取り込まない",
    noData: "このPCに同じデータなし",
    idChoiceLabel: "どちらに合わせる？",
    searchPlaceholder: "学級名・コードで検索",
  },
  subtotalGroup: {
    samePerson: "このPCのグループと同じものとして扱う",
    createNew: "新しいグループとして登録する",
    skip: "取り込まない",
    noData: "このPCに同じデータなし",
    idChoiceLabel: "どちらに合わせる？",
    searchPlaceholder: "グループ名・小計項目名で検索",
  },
}

/**
 * 生徒・学級の照合の画面が使う、取り込みウィザードの一部。試験の取り込み（useImportWizard）と
 * 生徒の取り込み（useStudentImportWizard）の両方がこの形で渡す
 */
export interface IdIntegrationWizard {
  state: {
    fileOverviewData: Partial<Record<EntityType, PreMatchingResult>> | null
    idIntegrationConfig: Record<
      "student" | "classroom",
      CategoryIdIntegrationConfig
    > &
      Partial<Record<"subtotalGroup", CategoryIdIntegrationConfig>>
  }
  updateIdIntegrationDecision: (
    category: EntityType,
    importId: string,
    decision: IdIntegrationDecision
  ) => void
  batchUpdateIdIntegrationDecisions: (
    category: EntityType,
    items: Array<{ importId: string; existingId: string }>,
    decisionType: IdIntegrationDecision["decisionType"],
    idChoice?: IdChoice
  ) => void
}

/** 生徒統合パネルProps */
export interface StudentIntegrationPanelProps {
  wizard: IdIntegrationWizard
  onStrategyChange: (strategy: StudentMatchingStrategy) => void
}

/** 学級統合パネルProps */
export interface ClassroomIntegrationPanelProps {
  wizard: IdIntegrationWizard
  onStrategyChange: (strategy: ClassroomMatchingStrategy) => void
}

/** 小計グループ統合パネルProps */
export interface SubtotalGroupIntegrationPanelProps {
  wizard: UseImportWizardReturn
  onStrategyChange: (strategy: SubtotalGroupMatchingStrategy) => void
}

/** 詳細パネルの共通Props */
export interface DetailPanelProps {
  wizard: IdIntegrationWizard
  entityType: EntityType
  showIndividualMessage: boolean
  /** 小計グループの小計項目の対応づけに使う（小計グループのときだけ） */
  subtotalWizard?: UseImportWizardReturn
}

/** ID統合の1行のProps */
export interface IntegrationItemRowProps {
  row: IdIntegrationRow
  entityType: EntityType
  /** 人が選ぶまで扱いを決めない（照合の候補が無い小計グループ） */
  requiresChoice: boolean
  /** 手で紐づけるときの選択肢 */
  allExistingItems: ExistingItemInfo[] | undefined
  /** 既存の行の id → 行（選んだ紐づけ先の見分ける材料を出すため） */
  existingRowsById: ReadonlyMap<string, Record<string, unknown>>
  /** 既存の行の id → それを紐づけ先にしているアーカイブの行 */
  claimedExistingIds: ReadonlyMap<string, string>
  onDecisionChange: (decision: IdIntegrationDecision) => void
  /** wizardインスタンス（小計グループの小計項目マッピング用） */
  wizard?: UseImportWizardReturn
}

/** 方針選択オプションProps */
export interface StrategyOptionProps {
  value: string
  id: string
  label: string
  description: string
  recommended?: boolean
}
