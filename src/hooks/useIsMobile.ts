import { useSyncExternalStore } from "react"

/** これより狭い窓では、サイドバーを畳まずに引き出し（Sheet）にする。Tailwind の `md` と同じ */
const MOBILE_BREAKPOINT = 768

const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribeToMobileMedia(onChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)
  mediaQueryList.addEventListener("change", onChange)
  return () => mediaQueryList.removeEventListener("change", onChange)
}

/**
 * いま窓が狭いか（effect やイベントの中で読む用）。
 *
 * `useIsMobile` はハイドレーションの最初の描画で false を返すので、その描画の effect は
 * 狭い窓でも広い窓として動く。描画の値で一度きりの動作（移動など）を決めるときはこちらを読む
 */
export function isMobileViewport(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

/** 窓が狭いか。shadcn の `use-mobile` を、effect の中で状態を書かない形に直したもの */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToMobileMedia,
    isMobileViewport,
    () => false
  )
}
