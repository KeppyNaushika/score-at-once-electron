import { useSyncExternalStore } from "react"

/** これより狭い窓では、サイドバーを畳まずに引き出し（Sheet）にする。Tailwind の `md` と同じ */
const MOBILE_BREAKPOINT = 768

const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribeToMobileMedia(onChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)
  mediaQueryList.addEventListener("change", onChange)
  return () => mediaQueryList.removeEventListener("change", onChange)
}

/** 窓が狭いか。shadcn の `use-mobile` を、effect の中で状態を書かない形に直したもの */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToMobileMedia,
    () => window.matchMedia(MOBILE_MEDIA_QUERY).matches,
    () => false
  )
}
