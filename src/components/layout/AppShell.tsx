"use client"

import { PanelLeftOpen } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useEffect, useMemo, useRef, useState } from "react"

import { BrowserStorageNotifier } from "@/components/common/BrowserStorageNotifier"
import { SyncFoldNotifier } from "@/components/common/SyncFoldNotifier"
import { SyncParentDeletedNotifier } from "@/components/common/SyncParentDeletedNotifier"
import { SyncWarningNotifier } from "@/components/common/SyncWarningNotifier"
import { ToastProvider } from "@/components/common/ToastProvider"
import Navigation from "@/components/layout/Navigation"
import {
  findSidebarSection,
  type SidebarBehavior,
  type SidebarSectionConfig,
  useSidebarBehavior,
} from "@/components/layout/sidebarBehavior"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"

/**
 * 設定をサイドバーの開閉へ押し出す。描くものは無い。
 *
 * **この枠（AppShell）は関門の外にある**ので、利用者が決まっていない窓（ログイン画面・
 * 認証の復元中）がある。設定は利用者に付いているので、決まってから読む——それを
 * 「利用者と区分が揃ったときだけ載せる」という形で表した。詰め物の `userId ?? ""` を
 * 置かずに済み、区分の外へ出れば載らない（＝戻ってきたら押し出し直す）も同じ形で出る。
 */
function SidebarBehaviorApplier({
  userId,
  section,
  setIsSidebarOpen,
}: {
  userId: string
  section: SidebarSectionConfig
  setIsSidebarOpen: (isOpen: boolean) => void
}) {
  const { behavior } = useSidebarBehavior(userId, section)
  const appliedRef = useRef<{
    sectionKey: string
    behavior: SidebarBehavior
  } | null>(null)

  // 区分が変わったときと、設定が変わったときだけ効かせる（設定の取得は非同期なので、
  // 初回は「読めた」時点がここに当たる）。同じ区分の中の遷移では動かさないので、
  // 利用者が手で開き直した状態は保たれる。
  useEffect(() => {
    const sectionKey = section.key
    const applied = appliedRef.current
    if (applied?.sectionKey === sectionKey && applied.behavior === behavior) {
      return
    }
    if (behavior === "none") {
      appliedRef.current = { sectionKey, behavior }
      return
    }

    // 押し出せたときに「押し出した」と記録する（途中で取り消されたら記録も残さない）
    const frame = requestAnimationFrame(() => {
      appliedRef.current = { sectionKey, behavior }
      setIsSidebarOpen(behavior !== "collapse")
    })

    return () => cancelAnimationFrame(frame)
  }, [behavior, section, setIsSidebarOpen])

  return null
}

/**
 * 狭い窓ではサイドバーが引き出しになって消えるので、本文の上に開くボタンだけの帯を置く。
 * 広い窓では出さない（開閉はサイドバーの中のボタンで行う）
 */
function MobileSidebarBar() {
  const { isMobile, setOpenMobile } = useSidebar()
  if (!isMobile) return null

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center border-b bg-background px-2">
      <Button variant="ghost" size="icon" onClick={() => setOpenMobile(true)}>
        <PanelLeftOpen />
        <span className="sr-only">サイドバーを開く</span>
      </Button>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  // 開閉は利用者の設定（SidebarBehaviorApplier）と手の操作の両方が書くので、ここで持って
  // Sidebar へ渡す。狭い窓での引き出しの開閉は Sidebar が自分で持つ
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const pathname = usePathname()
  const section = useMemo(() => findSidebarSection(pathname), [pathname])
  const { user } = useAuth()

  return (
    // 窓の高さに固定し、本文（SidebarInset）の中だけを流す。shadcn の既定は窓全体を
    // 流す形（min-h-svh）だが、各画面は本文が窓の高さに収まる前提で組んである
    <SidebarProvider
      open={isSidebarOpen}
      onOpenChange={setIsSidebarOpen}
      className="h-svh"
    >
      {user !== null && section !== null && (
        <SidebarBehaviorApplier
          userId={user.id}
          section={section}
          setIsSidebarOpen={setIsSidebarOpen}
        />
      )}
      <Navigation />
      <SidebarInset className="min-w-0 overflow-auto">
        <MobileSidebarBar />
        {/* 各画面は h-full で本文の高さいっぱいに組んであるので、狭い窓の帯を除いた残りの
            高さをここで決める。中身は以前の main と同じく block の中に並ぶ */}
        <div className="min-h-0 flex-1">{children}</div>
      </SidebarInset>
      <ToastProvider />
      {/* 同期で見え方が変わったことは起きた瞬間に伝える。窓が開いている間ずっと聞く */}
      <SyncFoldNotifier />
      <SyncParentDeletedNotifier />
      <SyncWarningNotifier />
      <BrowserStorageNotifier />
    </SidebarProvider>
  )
}
