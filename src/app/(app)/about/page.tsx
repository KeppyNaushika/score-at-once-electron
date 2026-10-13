"use client"

import PageHeader from "@/components/layout/PageHeader"
import { useIsWebRuntime } from "@/hooks/useIsWebRuntime"

import { ThirdPartyLicenseList } from "./components/ThirdPartyLicenseList"

/** バージョンとソースの在りか。手で書かず、ビルドのときに package.json から埋め込む（`next.config.ts`） */
const APP_VERSION = process.env.APP_VERSION ?? ""
const SOURCE_REPOSITORY_URL = process.env.APP_REPOSITORY_URL ?? ""

/**
 * 一括採点について。バージョン・ソースの在りか・ライセンス・同梱するライブラリのライセンス。
 *
 * AGPLv3 のもとで公開しているので、ネットワーク越しに使う web 版でも、利用者がソースを
 * 辿れるようにする（第13条）。ログインの前の画面からも辿れるよう、サイドバーに置く。
 *
 * ソースのリンクは、web 版ではブラウザの新しいタブで、デスクトップ版では main が既定の
 * ブラウザで開く（`electron-src/windowManager.ts` の `isSourceRepositoryUrl`）
 */
export default function AboutPage() {
  const isWebRuntime = useIsWebRuntime()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="一括採点について" />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-10 px-6 py-8">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">一括採点（Score at Once）</h2>
            <p className="text-sm">
              {`バージョン ${APP_VERSION}（${isWebRuntime ? "web 版" : "デスクトップ版"}）`}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">ライセンスとソースコード</h2>
            <p className="text-sm">
              一括採点は、GNU Affero General Public License
              第3版（AGPLv3）のもとで公開しています。ソースコードは、すべて次の場所で公開しています。
            </p>
            <p className="text-sm">
              <a
                href={SOURCE_REPOSITORY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-blue-600 underline underline-offset-2"
              >
                {SOURCE_REPOSITORY_URL}
              </a>
            </p>
            <p className="text-sm">
              ライセンスの本文は、ソースコードの{" "}
              <a
                href={`${SOURCE_REPOSITORY_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline underline-offset-2"
              >
                LICENSE
              </a>{" "}
              にあります。法令で認められる範囲において、一切の保証はありません（同ライセンス第15条・第16条）。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              同梱しているライブラリのライセンス
            </h2>
            <p className="text-sm text-muted-foreground">
              一括採点は、次のライブラリを同梱しています。それぞれのライセンスに従って使っています。
              {!isWebRuntime &&
                "Electron に含まれる Chromium などのライセンスは、配布物の LICENSES.chromium.html にあります（Windows・Linux ではアプリのフォルダの中、macOS ではアプリの「パッケージの内容を表示」から Contents/Resources の中）。"}
            </p>
            <ThirdPartyLicenseList />
          </section>
        </div>
      </div>
    </div>
  )
}
