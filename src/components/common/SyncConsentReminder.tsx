"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { SyncConsentDialog } from "@/components/common/SyncConsentDialog"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"
import { isSyncConsentCurrent } from "@/lib/shared/syncConsentText"
import { syncConfigQuery } from "@/queries/sync"

/**
 * 共有モードで動いているのに今の版の同意文に同意していないPCへ、起動のたびに同意を求める。
 *
 * **同期は止めない。** 同意の前から共有モードで使っているPC（同意の仕組みを入れる前の版から
 * 使っている・文面の版が上がった）を勝手に切ると、採点の途中で他のPCとの行き来が止まる。
 * 閉じたらこの起動のあいだは出さない。
 *
 * web 版は同期を持たないので何もしない。窓が開いている間ずっと置けるよう AppShell に置く。
 */
export function SyncConsentReminder() {
  const isWebRuntime = useIsWebRuntime()
  const { data: overview } = useQuery({
    ...syncConfigQuery(),
    enabled: !isWebRuntime,
  })
  const [isDismissed, setIsDismissed] = useState(false)

  if (
    isWebRuntime ||
    isDismissed ||
    overview === undefined ||
    overview.running.mode !== "shared" ||
    isSyncConsentCurrent(overview.config)
  ) {
    return null
  }

  return (
    <SyncConsentDialog
      situation="while-running"
      onConsented={() => setIsDismissed(true)}
      onClose={() => setIsDismissed(true)}
    />
  )
}
