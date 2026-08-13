import AuthGate from "@/components/auth/AuthGate"

/**
 * ログインしている人だけが入れる範囲。
 *
 * **守られるかどうかはファイルの置き場所が決める。** 以前は関門をページごとに
 * 置いていたので 40ページ中16ページにしか付いておらず、付け忘れても誰も気づけ
 * なかった。パス文字列の一覧で判定する形も採らない（一覧と実体が二重になり、
 * ページを足した人が更新し忘れる）。
 *
 * ここに置いていない `login/` だけが公開される。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>
}
