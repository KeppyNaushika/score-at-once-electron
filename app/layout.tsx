import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import AppShell from "@/components/layout/AppShell" // AppShell をインポート
import { AuthProvider } from "@/contexts/AuthContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "一括採点システム",
  description: "複数教員対応型採点アプリケーション",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
