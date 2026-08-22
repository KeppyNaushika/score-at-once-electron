"use client"

import { CourseworkListContainer } from "@/components/coursework/list/CourseworkListContainer"

/**
 * ヘッダー（題・戻る／進む・操作）は `EntityListPage` が持つので、ページは
 * 一覧を全面に置くだけ。4つのトップページで同じ形にしてある。
 */
export default function CourseworkPage() {
  return (
    <div className="h-full overflow-hidden">
      <CourseworkListContainer />
    </div>
  )
}
