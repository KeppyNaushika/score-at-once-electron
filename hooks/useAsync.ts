import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface UseAsyncOptions<T> {
  immediate?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  showErrorToast?: boolean
  errorToastMessage?: string
}

interface UseAsyncResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (...args: any[]) => Promise<T | null>
  reset: () => void
}

export function useAsync<T>(
  asyncFn: (...args: any[]) => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions<T> = {}
): UseAsyncResult<T> {
  const {
    immediate = true,
    onSuccess,
    onError,
    showErrorToast = true,
    errorToastMessage
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await asyncFn(...args)
      setData(result)
      
      if (onSuccess) {
        onSuccess(result)
      }
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "不明なエラーが発生しました"
      setError(errorMessage)
      
      if (showErrorToast) {
        toast.error(errorToastMessage || errorMessage)
      }
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage))
      }
      
      return null
    } finally {
      setLoading(false)
    }
  }, [asyncFn, onSuccess, onError, showErrorToast, errorToastMessage])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate, ...deps])

  return {
    data,
    loading,
    error,
    execute,
    reset
  }
}

// プリセット関数：ElectronAPIの一般的なパターン用
export function useElectronAsync<T>(
  apiCall: (...args: any[]) => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions<T> = {}
) {
  return useAsync(apiCall, deps, {
    showErrorToast: true,
    ...options
  })
}