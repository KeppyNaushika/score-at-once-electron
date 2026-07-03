"use client"

import { useRouter } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface DirtyDetail {
  label: string
  count: number
}

interface NavigationGuardContextType {
  isDirty: boolean
  setNavigationGuard: (isDirty: boolean, details?: DirtyDetail[]) => void
  clearNavigationGuard: () => void
  guardedNavigate: (href: string) => void
  requestNavigation: (href: string) => boolean
}

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  isDirty: false,
  setNavigationGuard: () => {},
  clearNavigationGuard: () => {},
  guardedNavigate: () => {},
  requestNavigation: () => true,
})

/** ナビゲーションガードコンテキストから未保存確認・遷移制御の機能を取得するフック */
export function useNavigationGuardContext() {
  return useContext(NavigationGuardContext)
}

/** 未保存データがある場合の離脱確認ダイアログを管理するプロバイダー */
export function NavigationGuardProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isDirty, setIsDirty] = useState(false)
  const [details, setDetails] = useState<DirtyDetail[]>([])
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const isDirtyRef = useRef(false)

  const setNavigationGuard = useCallback(
    (dirty: boolean, newDetails?: DirtyDetail[]) => {
      setIsDirty(dirty)
      isDirtyRef.current = dirty
      if (newDetails) {
        setDetails(newDetails)
      }
    },
    []
  )

  const clearNavigationGuard = useCallback(() => {
    setIsDirty(false)
    isDirtyRef.current = false
    setDetails([])
  }, [])

  const guardedNavigate = useCallback(
    (href: string) => {
      if (isDirtyRef.current) {
        setPendingHref(href)
        setDialogOpen(true)
      } else {
        router.push(href)
      }
    },
    [router]
  )

  const requestNavigation = useCallback((href: string): boolean => {
    if (isDirtyRef.current) {
      setPendingHref(href)
      setDialogOpen(true)
      return false
    }
    return true
  }, [])

  // beforeunload handler
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  const handleLeave = useCallback(() => {
    setDialogOpen(false)
    if (pendingHref) {
      clearNavigationGuard()
      router.push(pendingHref)
      setPendingHref(null)
    }
  }, [pendingHref, clearNavigationGuard, router])

  const handleStay = useCallback(() => {
    setDialogOpen(false)
    setPendingHref(null)
  }, [])

  return (
    <NavigationGuardContext.Provider
      value={{
        isDirty,
        setNavigationGuard,
        clearNavigationGuard,
        guardedNavigate,
        requestNavigation,
      }}
    >
      {children}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未保存のデータがあります</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {details.length > 0 && (
                  <ul className="my-2 list-inside list-disc">
                    {details
                      .filter((detail) => detail.count > 0)
                      .map((detail) => (
                        <li key={detail.label}>
                          {detail.label}: {detail.count}件
                        </li>
                      ))}
                  </ul>
                )}
                <p>このまま画面を離れるとこれらのデータは失われます。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStay}>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>離れる</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  )
}
