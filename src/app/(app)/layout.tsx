import AuthGate from "@/components/auth/AuthGate"
import { LocalPreferenceHandover } from "@/components/common/LocalPreferenceHandover"
import { ScreenBlackout } from "@/components/common/ScreenBlackout"

/**
 * ログインしている人だけが入れる範囲。
 *
 * **守られるかどうかはファイルの置き場所が決める。** 以前は関門をページごとに
 * 置いていたので 40ページ中16ページにしか付いておらず、付け忘れても誰も気づけ
 * なかった。パス文字列の一覧で判定する形も採らない（一覧と実体が二重になり、
 * ページを足した人が更新し忘れる）。
 *
 * ここに置いていない `login/` だけが公開される。
 *
 * 画面の目隠し（`ScreenBlackout`）もここに置く。**目隠しは利用者の設定で決まる**
 * ので、誰かが決まっていない場所には出しようがない。以前は関門の外（`AppShell`）に
 * あり、利用者が居ない間は設定が全部既定値に落ちて何もしない部品として回っていた。
 *
 * `localStorage` からの写し（`LocalPreferenceHandover`）も同じ理由でここに置く。
 * 写す先が利用者の設定なので、誰か決まってからでないと写せない。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {children}
      <LocalPreferenceHandover />
      <ScreenBlackout />
    </AuthGate>
  )
}
