import { useEffect } from "react"

import {
  type DirtyDetail,
  useNavigationGuardContext,
} from "@/contexts/NavigationGuardContext"

/** 未保存データがある場合にページ離脱を防止するナビゲーションガードフック */
export function useNavigationGuard(isDirty: boolean, details: DirtyDetail[]) {
  const { setNavigationGuard, clearNavigationGuard, guardedNavigate } =
    useNavigationGuardContext()

  useEffect(() => {
    setNavigationGuard(isDirty, details)
  }, [isDirty, details, setNavigationGuard])

  useEffect(() => {
    return () => {
      clearNavigationGuard()
    }
  }, [clearNavigationGuard])

  return { guardedNavigate }
}
