"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import PageHeader from "@/components/layout/PageHeader"
import { TagsPageContainer } from "@/components/tag/TagsPageContainer"

export default function TagsPage() {
  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="タグ管理" />
        <div className="flex-1 overflow-hidden">
          <TagsPageContainer />
        </div>
      </div>
    </ProtectedRoute>
  )
}
