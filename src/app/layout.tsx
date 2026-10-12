import "./globals.css"

import type { Metadata } from "next"
import { Inter } from "next/font/google"

import AppShell from "@/components/layout/AppShell"
import { AuthProvider } from "@/contexts/AuthContext"
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext"
import { QueryProvider } from "@/contexts/QueryProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "一括採点",
  description: "複数教員対応型採点アプリケーション",
  icons: {
    icon: "/一括採点アイコン.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        {/*
          MathJax の設定と本体の読み込みは外のファイルに置く（web 版の CSP でインラインの
          スクリプトを許さないため）。設定を置いてから本体を足す順は、そのファイルが守る
        */}
        <script async src="/js/mathJaxConfig.js" />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <NavigationGuardProvider>
              <AppShell>{children}</AppShell>
            </NavigationGuardProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
