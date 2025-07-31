"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

interface ExportWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  warnings: {
    noScoringData: string[]
    unscored: string[]
    missingPartialScore: string[]
  }
}

export default function ExportWarningModal({
  isOpen,
  onClose,
  onContinue,
  warnings,
}: ExportWarningModalProps) {
  const hasWarnings =
    warnings.noScoringData.length > 0 ||
    warnings.unscored.length > 0 ||
    warnings.missingPartialScore.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            警告
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 採点データがない設問答案 */}
          {warnings.noScoringData.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="mb-2 font-medium">
                  次の設問答案の採点データがありません
                </div>
                <div className="space-y-1 text-sm">
                  {warnings.noScoringData.map((item, index) => (
                    <div key={index} className="pl-2">
                      • {item}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 未採点の設問答案 */}
          {warnings.unscored.length > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <div className="mb-2 font-medium">次の設問答案が未採点です</div>
                <div className="space-y-1 text-sm">
                  {warnings.unscored.map((item, index) => (
                    <div key={index} className="pl-2">
                      • {item}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 部分点が入力されていない設問 */}
          {warnings.missingPartialScore.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="mb-2 font-medium">
                  次の部分点が入力されていません
                </div>
                <div className="space-y-1 text-sm">
                  {warnings.missingPartialScore.map((item, index) => (
                    <div key={index} className="pl-2">
                      • {item}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!hasWarnings && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                採点データに問題は見つかりませんでした。
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              {hasWarnings ? (
                <>
                  上記の問題がある状態でExcelファイルを出力すると、該当箇所は適切に表示されない可能性があります。
                  それでも続行する場合は「警告を無視して続行」をクリックしてください。
                </>
              ) : (
                "すべての採点データが正常に入力されています。出力を続行できます。"
              )}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={onContinue}
              variant={hasWarnings ? "destructive" : "default"}
              className={hasWarnings ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              {hasWarnings ? "警告を無視して続行" : "続行"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
