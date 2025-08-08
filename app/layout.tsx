import AppShell from "@/components/layout/AppShell"
import { AuthProvider } from "@/contexts/AuthContext"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                  displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                  processEscapes: true,
                  processEnvironments: true
                },
                svg: {
                  fontCache: 'global'
                },
                startup: {
                  ready: () => {
                    console.log('🔥 MathJax initialized successfully');
                    MathJax.startup.defaultReady();
                    // 初期化完了をグローバルに通知
                    window.mathJaxReady = true;
                    window.dispatchEvent(new Event('mathjax-ready'));
                  }
                }
              };
            `,
          }}
        />
        <script
          id="MathJax-script"
          async
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
