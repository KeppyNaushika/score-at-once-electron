/**
 * ID統合ステップの型定義
 */

import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ClassMatchingStrategy,
  IdChoice,
  MatchedItem,
  StudentMatchingStrategy,
  SubtotalGroupMatchingStrategy,
} from "@/types/projectArchive.types"

export type CategoryType = "student" | "class" | "subtotalGroup"

export type EntityType = "student" | "class" | "subtotalGroup"

/** 決定タイプ */
export type DecisionType = "same_person" | "create_new" | "skip"
export type NoMatchDecisionType = "create_new" | "skip"

/** エンティティごとのラベル設定 */
export interface EntityLabels {
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
  class: {
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
export interface IntegrationPanelBaseProps {
  wizard: UseImportWizardReturn
}

/** 生徒統合パネルProps */
export interface StudentIntegrationPanelProps extends IntegrationPanelBaseProps {
  onStrategyChange: (strategy: StudentMatchingStrategy) => void
}

/** 学級統合パネルProps */
export interface ClassIntegrationPanelProps extends IntegrationPanelBaseProps {
  onStrategyChange: (strategy: ClassMatchingStrategy) => void
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
}

/** マッチしたアイテム行のProps */
export interface MatchedItemRowProps {
  item: MatchedItem
  entityType: EntityType
  currentDecision?: DecisionType
  currentIdChoice?: IdChoice
  onDecisionChange: (decision: DecisionType, idChoice?: IdChoice) => void
}

/** マッチしなかったアイテム行のProps */
export interface NoMatchItemRowProps {
  item: { importId: string; displayLabel: string }
  onDecisionChange: (decision: NoMatchDecisionType) => void
}

/** 方針選択オプションProps */
export interface StrategyOptionProps {
  value: string
  id: string
  label: string
  description: string
  recommended?: boolean
}
