"use client"

import { AlertTriangle, FileArchive, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"

/**
 * 外部フォーマット別の表示情報
 */
const FORMAT_INFO = {
  hsz: {
    productName: "百問繚乱",
    companyName: "株式会社シンプルエデュケーション",
  },
  dat: {
    productName: "リアテンダント",
    companyName: "大日本印刷株式会社",
  },
} as const

interface HszDisclaimerModalProps {
  wizard: UseImportWizardReturn
}

export function HszDisclaimerModal({ wizard }: HszDisclaimerModalProps) {
  const { state, acceptHszDisclaimer, dismissHszDisclaimer } = wizard
  const [agreed, setAgreed] = useState(false)

  const fileName = state.hszOriginalPath
    ? (state.hszOriginalPath.split(/[/\\]/).pop() ?? "")
    : ""

  const formatKey = state.sourceFormat === "dat" ? "dat" : "hsz"
  const { productName, companyName } = FORMAT_INFO[formatKey]

  // モーダルが開くたびに同意状態をリセット
  useEffect(() => {
    if (state.showHszDisclaimer) {
      setAgreed(false)
    }
  }, [state.showHszDisclaimer])

  return (
    <Dialog
      open={state.showHszDisclaimer === true}
      onOpenChange={(open) => {
        if (!open && !state.isProcessing) {
          dismissHszDisclaimer()
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            他社フォーマットの変換
          </DialogTitle>
          <DialogDescription>
            {productName}
            のデータファイルを一括採点形式に変換します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ファイル名表示 */}
          <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
            <FileArchive className="text-muted-foreground h-5 w-5 shrink-0" />
            <span className="text-sm font-medium break-all">{fileName}</span>
          </div>

          {/* 変換に関する注意事項 */}
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <p className="text-sm font-medium">変換に関する注意事項</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>
                採点領域の座標は自動変換されますが、精度を保証するものではありません
              </li>
              <li>
                変換後、テンプレート編集画面で各領域の位置を確認・調整してください
              </li>
              <li>
                模範解答画像と採点領域のみがインポートされます（生徒・採点結果は含まれません）
              </li>
            </ul>
          </div>

          {/* 免責事項 */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">免責事項</p>
            <div className="text-muted-foreground space-y-2 text-xs leading-relaxed">
              <p>
                本ソフトウェアは、{companyName}
                とは一切の関係がなく、同社からの承認・推奨・技術提供を受けたものではありません。
              </p>
              <p>
                本ソフトウェアに含まれるファイル読み込み機能は、公開されているデータ形式をもとに独自に実装した変換機能であり、同社のソフトウェアの技術・ソースコード・ライセンスに依拠するものではありません。
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-1">
                <li>
                  <span className="font-medium">動作の保証について：</span>
                  本機能による読み込み結果の正確性・完全性について、いかなる保証も行いません。読み込み後のデータについては、必ずご自身で内容をご確認ください。
                </li>
                <li>
                  <span className="font-medium">
                    データ形式の変更について：
                  </span>
                  ソフトウェアの更新等によりデータ形式が変更された場合、本機能が正常に動作しなくなる可能性があります。
                </li>
                <li>
                  <span className="font-medium">データの利用について：</span>
                  読み込むファイルに含まれるコンテンツ（問題文・解答等）の著作権は、その作成者または権利者に帰属します。ファイルの利用にあたっては、各コンテンツの利用条件を遵守してください。
                </li>
                <li>
                  <span className="font-medium">免責：</span>
                  本機能の使用により生じたいかなる損害についても、本ソフトウェアの開発者は一切の責任を負いません。
                </li>
              </ul>
            </div>

            {/* 商標表示 */}
            <div className="text-muted-foreground border-t pt-2 text-[11px] leading-relaxed">
              <p>
                「百問繚乱」は、株式会社シンプルエデュケーションの登録商標または商標です。
              </p>
              <p>
                「リアテンダント」は、大日本印刷株式会社の登録商標または商標です。
              </p>
              <p>
                その他、本ソフトウェア内で使用されている会社名・製品名等は、各社の登録商標または商標です。
              </p>
            </div>
          </div>

          {/* 同意チェックボックス */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 select-none has-checked:border-amber-400 has-checked:bg-amber-50 dark:has-checked:bg-amber-950/20">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              disabled={state.isProcessing}
              className="mt-0.5"
            />
            <span className="text-sm">
              上記の免責事項を確認し、同意のうえ変換を行います
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={dismissHszDisclaimer}
            disabled={state.isProcessing}
          >
            キャンセル
          </Button>
          <Button
            onClick={acceptHszDisclaimer}
            disabled={state.isProcessing || !agreed}
          >
            {state.isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                変換中...
              </>
            ) : (
              "変換して読み込む"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
