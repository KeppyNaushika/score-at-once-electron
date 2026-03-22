"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { SubtotalGroupsPageContainer } from "@/components/subtotal-groups/SubtotalGroupsPageContainer"

export default function SubtotalGroupsPage() {
  const { helpButton } = usePageHelp()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="小計点グループ管理" helpButton={helpButton} />
      <div className="flex-1 overflow-hidden">
        <SubtotalGroupsPageContainer />
      </div>
    </div>
  )
}
