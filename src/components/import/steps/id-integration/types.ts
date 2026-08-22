/**
 * ID統合ステップの型定義
 */

import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ClassroomMatchingStrategy,
  ExistingItemInfo,
  IdChoice,
  MatchedItem,
  StudentMatchingStrategy,
  SubtotalGroupMatchingStrategy,
} from "@/types/examArchive.types"

export type CategoryType = "student" | "classroom" | "subtotalGroup" | "user"

export type EntityType = "student" | "classroom" | "subtotalGroup"

/** 決定タイプ */
export type DecisionType = "same_person" | "create_new" | "skip"
export type NoMatchDecisionType = "create_new" | "skip"

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
}

/** エンティティラベルの定義 */
export const ENTITY_LABELS: Record<EntityType, EntityLabels> = {
  student: {
    samePerson: "このPCの生徒と同じ人として扱う",
    createNew: "新しい生徒として登録する",
    skip: "取り込まない",
    noData: "このPCに同じデータなし",
    idChoiceLabel: "どちらに合わせる？",
  },
  classroom: {
    samePerson: "このPCの学級と同じものとして扱う",
    createNew: "新しい学級として登録する",
    skip: "取り込まない",
    noData: "このPCに同じデータなし",
    idChoiceLabel: "どちらに合わせる？",
  },
  subtotalGroup: {
    samePerson: "このPCのグループと同じものとして扱う",
    createNew: "新しいグループとして登録する",
    skip: "取り込まない",
    noData: "このPCに同じデータなし",
    idChoiceLabel: "どちらに合わせる？",
  },
}

/** 統合パネルの共通Props */
interface IntegrationPanelBaseProps {
  wizard: UseImportWizardReturn
}

/** 生徒統合パネルProps */
export interface StudentIntegrationPanelProps extends IntegrationPanelBaseProps {
  onStrategyChange: (strategy: StudentMatchingStrategy) => void
}

/** 学級統合パネルProps */
export interface ClassroomIntegrationPanelProps extends IntegrationPanelBaseProps {
  onStrategyChange: (strategy: ClassroomMatchingStrategy) => void
}

/** 小計グループ統合パネルProps */
export interface SubtotalGroupIntegrationPanelProps extends IntegrationPanelBaseProps {
  onStrategyChange: (strategy: SubtotalGroupMatchingStrategy) => void
}

/** 詳細パネルの共通Props */
export interface DetailPanelProps {
  wizard: UseImportWizardReturn
  entityType: EntityType
  byName: MatchedItem[]
  noMatch: Array<{ importId: string; displayLabel: string }>
  showIndividualMessage: boolean
  onBatchIdChoice?: (idChoice: IdChoice) => void
  /** 全既存アイテム一覧（手動紐づけ用、小計グループで使用） */
  allExistingItems?: ExistingItemInfo[]
  /** noMatchアイテムの一括決定コールバック */
  onBatchNoMatchDecision?: (decision: NoMatchDecisionType) => void
}

/** マッチしたアイテム行のProps */
export interface MatchedItemRowProps {
  item: MatchedItem
  entityType: EntityType
  currentDecision?: DecisionType
  currentIdChoice?: IdChoice
  onDecisionChange: (decision: DecisionType, idChoice?: IdChoice) => void
  /** wizardインスタンス（subtotalGroupのマッピングエディタ用） */
  wizard?: UseImportWizardReturn
}

/** マッチしなかったアイテム行のProps */
export interface NoMatchItemRowProps {
  item: { importId: string; displayLabel: string }
  onDecisionChange: (
    decision: NoMatchDecisionType | DecisionType,
    existingId?: string,
    idChoice?: IdChoice
  ) => void
  /** エンティティ種別（subtotalGroupの場合、手動紐づけを許可） */
  entityType?: EntityType
  /** 全既存アイテム一覧（手動紐づけ用） */
  allExistingItems?: ExistingItemInfo[]
  /** wizardインスタンス（subtotalGroupの小計項目マッピング用） */
  wizard?: UseImportWizardReturn
  /** 既にマッチ済みの既存ID一覧（重複防止） */
  alreadyMatchedExistingIds?: Set<string>
}

/** 方針選択オプションProps */
export interface StrategyOptionProps {
  value: string
  id: string
  label: string
  description: string
  recommended?: boolean
}
