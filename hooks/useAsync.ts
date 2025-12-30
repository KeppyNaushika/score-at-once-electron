import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface UseAsyncOptions<T> {
  immediate?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  showErrorToast?: boolean
  errorToastMessage?: string
}

interface UseAsyncResult<T, Args extends unknown[]> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
}

export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions<T> = {}
): UseAsyncResult<T, Args> {
  const {
    immediate = true,
    onSuccess,
    onError,
    showErrorToast = true,
    errorToastMessage,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
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
        const errorMessage =
          err instanceof Error ? err.message : "不明なエラーが発生しました"
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
    },
    [asyncFn, onSuccess, onError, showErrorToast, errorToastMessage]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (immediate) {
      // immediate呼び出しでは引数なしで実行される（Args = [] の場合に対応）
      execute(...([] as unknown as Args))
    }
  }, [execute, immediate, deps])

  return {
    data,
    loading,
    error,
    execute,
    reset,
  }
}

// プリセット関数：ElectronAPIの一般的なパターン用
export function useElectronAsync<T, Args extends unknown[] = []>(
  apiCall: (...args: Args) => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions<T> = {}
): UseAsyncResult<T, Args> {
  return useAsync(apiCall, deps, {
    showErrorToast: true,
    ...options,
  })
}
