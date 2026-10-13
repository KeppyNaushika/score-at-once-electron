"use client"

import Link from "next/link"

import { useBrowserStorageStatus } from "@/app/(app)/settings/hooks/useBrowserStorageStatus"
import { CautionNotice } from "@/components/common/CautionNotice"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  formatStorageBytes,
  isStorageNearlyFull,
} from "@/lib/browserStorageUsage"

/**
 * web 版で、データを置いているブラウザの保存領域の状態（設定の項目。web 版でだけ出す）。
 *
 * データはこのブラウザの中にだけあり、ホストには無い。ブラウザに消されたら戻せないので、
 * 消さない約束の有無と残りの量を見せ、`.sao` での控えへ導く。
 */
export function BrowserStorageSection() {
  const { status, isRequesting, requestPersistence } = useBrowserStorageStatus()

  if (!status) return null

  const usagePercent =
    status.quota > 0 ? Math.min(100, (status.usage / status.quota) * 100) : 0

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">データの置き場所</h2>
          <p className="text-sm text-muted-foreground">
            {"web 版のデータ（試験・答案の画像・成績など）は、このブラウザの中にだけ置かれます。" +
              "サーバーには送られません。別のブラウザや別のPCからは見えず、" +
              "ブラウザのサイトデータを消すと一緒に消えます。"}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">消されないための保護</h2>
        {status.persisted ? (
          <p className="text-sm">
            保護されています。空き容量が足りなくなっても、ブラウザがこのデータを勝手に消すことはありません。
          </p>
        ) : (
          <>
            <CautionNotice>
              {"保護されていません。ブラウザは空き容量が足りなくなると、知らせずにこのデータを消すことがあります。\n" +
                "ブラウザは、ブックマークやアプリとしてのインストールなど、このサイトの使われ方を見て保護するかを決めます。" +
                "保護されるまでは、データ書き出し（.sao）で控えを取っておいてください。"}
            </CautionNotice>
            <Button
              variant="outline"
              disabled={isRequesting}
              onClick={() => void requestPersistence()}
            >
              保護を頼む
            </Button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">使っている量</h2>
        <Progress value={usagePercent} aria-label="保存領域の使用量" />
        <p className="text-sm">
          {`${formatStorageBytes(status.quota)} のうち ${formatStorageBytes(status.usage)} を使っています（${usagePercent.toFixed(0)}%）。`}
        </p>
        {isStorageNearlyFull(status.usage, status.quota) && (
          <CautionNotice>
            {"残りが少なくなっています。いっぱいになると、答案の取り込みや出力が途中で止まります。" +
              "使わなくなった試験を .sao に書き出してから削除すると空きます。"}
          </CautionNotice>
        )}
        <p className="text-sm text-muted-foreground">
          上限はブラウザが端末の空き容量から決めます。数字はブラウザの見積もりです。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">控えを取る</h2>
        <p className="text-sm text-muted-foreground">
          {"データ書き出しで .sao に書き出したファイルは、このブラウザの外に残ります。" +
            "別のPCや、デスクトップ版でも読み込めます。"}
        </p>
        <Button asChild variant="outline">
          <Link href="/data-export">データ書き出しを開く</Link>
        </Button>
      </section>
    </div>
  )
}
