"use client"

import {
  Callout,
  FocusSection,
  HelpDoc,
  HelpHero,
} from "@/components/help/common/DocComponents"

/**
 * web 版の設定画面の使い方ガイド。データがどこにあり、どう守り、どう持ち運ぶかを書く。
 *
 * デスクトップ版の設定は手引きを持たない（同期の手引き `HelpContentSync` は同期設定の
 * 画面のもので、web 版には同期が無い）。web 版の設定にだけこちらを出す
 * （`usePageHelp` の `webPageHelpComponents`）。
 *
 * **設定の「ブラウザの保存領域」（`BrowserStorageSection`）とは重ねない。** あちらは
 * いまの状態（保護の有無・使っている量）、こちらは仕組みと、控え・持ち運びの手順を書く。
 *
 * 書いてある挙動は、すべて実装で確かめたもの:
 * - データの置き場所がブラウザの中（OPFS）だけであること — `web/worker/opfsFs.ts`
 * - 消されないための保護 — `src/components/common/BrowserStorageNotifier.tsx`
 * - 1つのタブでしか開けないこと — `web/page/entry.ts` の Web Locks
 * - 書き出しがブラウザのダウンロードになること — `web/worker/downloadArea.ts`
 * - 複数のファイルを zip 1つにまとめること — `electron-src/lib/multiFileOutput.ts`
 * - PDF を印刷ダイアログで保存すること — `web/page/htmlPrinter.ts`、`src/lib/outputResultText.ts`
 * - web 版で読み込めるのが .sao だけであること — `ArchiveImportFormatsNote.tsx`
 * - デスクトップ版だけの機能 — 同期設定の画面・`Navigation.tsx` の `isDesktopOnly`
 */
export function HelpContentWebVersion() {
  return (
    <HelpDoc>
      <HelpHero
        eyebrow="設定 / web 版"
        title="web 版のデータは、このブラウザの中にあります"
        lead="web 版は、ブラウザで開くだけで使える一括採点です。試験・答案の画像・成績などのデータは、すべてこのブラウザの中に置かれ、サーバーには送られません。このページでは、データを失わないための控えの取り方と、別のPCへの持ち運び方を説明します。"
      />

      <FocusSection title="① データの置き場所">
        <p>
          web
          版のサイトから届くのは、一括採点の画面と処理の仕組みだけです。採点や取り込みは、すべてこのブラウザの中で行われ、データもこのブラウザの中に保存されます。サーバーにデータを預けることはありません。
        </p>
        <p>
          そのため、データは<strong>このPCの、このブラウザ</strong>
          からしか見えません。別のブラウザや別のPC、同じブラウザの別のプロファイルで開くと、データの無い状態から始まります。
        </p>
        <Callout type="warning" title="サイトのデータを消すと、一緒に消えます">
          ブラウザの設定で「閲覧履歴データの削除」などからこのサイトのデータ（Cookie
          とサイトデータ）を消すと、一括採点のデータもすべて消えます。消したデータは、サーバーにも無いので戻せません。
        </Callout>
      </FocusSection>

      <FocusSection title="② ブラウザに消されないようにする">
        <p>
          ブラウザは、PCの空き容量が足りなくなると、サイトのデータを知らせずに消すことがあります。一括採点は開いたときに、このデータを消さないようブラウザに頼みます。頼みが通らなかったときは、画面の右下で知らせます。
        </p>
        <p>
          いまの状態は、設定の「ブラウザの保存領域」で確かめられます。保護されていないときは、そこから「保護を頼む」を押せます。ブラウザは、ブックマークやアプリとしてのインストールなど、このサイトの使われ方を見て保護するかを決めます。
        </p>
        <Callout type="tip" title="保護されていても、控えは取っておく">
          保護されていても、ブラウザのデータを消す操作やPCの故障からは守れません。採点が一区切りしたら、次の
          ③ の手順で .sao の控えを取っておいてください。
        </Callout>
      </FocusSection>

      <FocusSection title="③ .sao で控えを取る・別のPCへ持ち運ぶ">
        <p>
          サイドバーの「データ書き出し」で、試験などを選んで .sao
          のファイルに書き出します。選んだものに関わるデータ（生徒・答案の画像・採点など）もまとめて入ります。書き出したファイルは、ブラウザのダウンロードとして保存され、このブラウザの外に残ります。
        </p>
        <p>
          別のPCで続けるときは、その .sao
          をそのPCへ移し、試験などの一覧の「取り込み」から読み込みます。デスクトップ版でも、同じ
          .sao を読み込めます。
        </p>
        <Callout type="note" title="web 版で読み込めるのは .sao だけです">
          以前の形式（.score・.coursework・.grade・.asb・.students など）は、web
          版では読み込めません。デスクトップ版で読み込んでから .sao
          に書き出し、それを web 版へ持ち込んでください。
        </Callout>
      </FocusSection>

      <FocusSection title="④ 開けるのは1つのタブだけ">
        <p>
          データは、1つのタブでしか開けません。一括採点を開いているときに別のタブでも開くと、「別のタブで
          Score at Once
          が開いています」と出て止まります。開いているタブを使うか、そのタブを閉じてから再読み込みしてください。
        </p>
      </FocusSection>

      <FocusSection title="⑤ 書き出したファイルと PDF">
        <p>
          Excel・PNG・.sao
          などの書き出しは、ブラウザのダウンロードになります。保存先は、ブラウザのダウンロードの設定で決まります。ページごとの
          PDF や PNG のように何枚にも分かれるものは、zip
          1つにまとめてダウンロードします。
        </p>
        <p>
          PDF
          は、ブラウザの印刷の画面を使って作ります。印刷の画面が開いたら、送信先で「PDF
          に保存」を選んで保存してください。印刷の画面を閉じたあと、保存したのかやめたのかをブラウザは知らせないので、一括採点は「印刷ダイアログを閉じました」とだけ伝えます。保存先を確かめてください。
        </p>
      </FocusSection>

      <FocusSection title="⑥ デスクトップ版でだけ使える機能">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            共有フォルダを通した複数のPCでの同期（共有モード）。web
            版は1人で使うためのものです
          </li>
          <li>AI採点</li>
          <li>以前の形式（.score など）の読み込み</li>
        </ul>
      </FocusSection>

      <FocusSection title="⑦ 使えるブラウザ">
        <p>
          パソコンの Google Chrome で動作を確かめています。Microsoft Edge
          も同じ仕組みのブラウザです。Safari と Firefox
          では、まだ確かめていません。
        </p>
      </FocusSection>
    </HelpDoc>
  )
}
