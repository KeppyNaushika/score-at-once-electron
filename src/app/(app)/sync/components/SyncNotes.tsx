import { CircleAlert } from "lucide-react"

import { BetaBadge } from "@/components/common/BetaBadge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SYNC_CONSENT_ITEMS } from "@/lib/shared/syncConsentText"

/**
 * 同期を使う人への注意事項。**段ごとに役割を決めて並べる。**
 *
 * 現象を思いついた順に並べると、何を決めればよいのか読み取れない。段の役割は次の3つで、
 * この順に置く。どの段も畳まず、常に見えるようにする。
 *
 * 1. **同意いただいたこと** —— 何を保証しないか・取り返しがつかない操作。共有モードへ
 *    入る前に1項目ずつ同意を求める項目（`SYNC_CONSENT_ITEMS`）をそのまま出す
 * 2. **使い始める前に** —— 満たしていないと使えない条件
 * 3. **使っているあいだ** —— そういう仕様だと知っておくこと
 *
 * 技術の言葉（版・主キー・親行・畳み）は使わない。利用者はデータの作りを知らないので、
 * **画面で見えるもの（試験・採点結果・タグ）を主語にする**。
 */
const SYNC_NOTICE_SECTIONS: { heading: string; items: string[] }[] = [
  {
    heading: "使い始める前に",
    items: [
      "一括採点そのものは、PCごとに入れてください。共有フォルダに置いた一括採点を起動する使い方はできません（読み込みが遅すぎて起動できません）。共有するのはデータだけです。",
      "ローカルモードと共有モードは、別々のデータです。切り替えてもデータは行き来せず、共有をやめても共有フォルダの内容はこのPCへ書き戻されません。",
      "同期するPCは、すべて同じバージョンの一括採点にしてください。バージョンが違うPCとは、やりとりを行いません。",
    ],
  },
  {
    heading: "使っているあいだ",
    items: [
      "直した内容が他のPCに現れるのは、そのPCが次に同期したときです。すぐには映りません。",
      "共有フォルダに届かないときは、このPCの控えで起動します。そのあいだは同期されず、答案などの画像も表示されません。共有フォルダに届くようになれば、同期は進みます。",
      "別々の設問を採点していれば、どちらの採点も残ります。同じものを2人が同時に直したときだけ、あとに保存した方の内容が残ります。",
      "別々のPCで同じ名前のタグを作ると、タグは1つにまとまって表示されます。名前を変えて分ければ、元の2つに戻ります。",
    ],
  },
]

/**
 * 同期を使う人への注意事項。**全部が常に画面にある（畳まない）。**
 *
 * 同期のトーストは流れて消えるうえ、起きてからしか出ない。起きる前に読める場所が要る。
 * 畳むと読まれないので、畳む仕掛けは置かない。
 */
export function SyncNotes() {
  return (
    <Alert>
      <CircleAlert className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        同期についてのご注意
        <BetaBadge />
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-3 text-sm">
          <section>
            <h4 className="font-medium">同意いただいたこと</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {SYNC_CONSENT_ITEMS.map((consentItem) => (
                <li key={consentItem.key}>
                  <span className="font-medium text-foreground">
                    {consentItem.title}。
                  </span>
                  {consentItem.body}
                </li>
              ))}
            </ul>
          </section>
          {SYNC_NOTICE_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h4 className="font-medium">{section.heading}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  )
}
