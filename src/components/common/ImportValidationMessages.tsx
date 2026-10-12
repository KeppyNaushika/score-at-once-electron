import { CircleAlert, TriangleAlert } from "lucide-react"

interface ImportValidationMessagesProps {
  validation: { valid: number; errors: string[]; warnings: string[] }
  /** 有効件数の表示で数える対象（「{valid}件の◯◯が有効です」の◯◯） */
  validRowNoun: string
}

/** 貼り付け取り込みの検証結果（エラー・警告・有効件数）を並べて示す */
export default function ImportValidationMessages({
  validation,
  validRowNoun,
}: ImportValidationMessagesProps) {
  return (
    <div className="space-y-2">
      {validation.errors.length > 0 && (
        <div className="rounded-md bg-red-50 p-3">
          <div className="flex">
            <CircleAlert className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc space-y-1 pl-5">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-md bg-yellow-50 p-3">
          <div className="flex">
            <TriangleAlert className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">警告</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc space-y-1 pl-5">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {validation.valid > 0 && (
        <div className="rounded-md bg-green-50 p-3">
          <div className="text-sm text-green-700">
            ✅ {validation.valid}件の{validRowNoun}が有効です
          </div>
        </div>
      )}
    </div>
  )
}
