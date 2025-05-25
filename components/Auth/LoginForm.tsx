"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    // TODO: Implement actual login logic with electronAPI
    console.log("Login attempt:", { username, password })
    // Example:
    // try {
    //   const user = await window.electronAPI.loginUser(username, password);
    //   if (user) {
    //     // Navigate to dashboard or home
    //     // router.push('/dashboard');
    //   } else {
    //     setError("ユーザー名またはパスワードが正しくありません。");
    //   }
    // } catch (err) {
    //   setError("ログイン中にエラーが発生しました。");
    //   console.error(err);
    // }
    alert(
      "ログイン処理は未実装です。\nユーザー名: " +
        username +
        "\nパスワード: " +
        password,
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">ログイン</CardTitle>
        <CardDescription>
          アカウント情報を入力してログインしてください。
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              type="text"
              placeholder="教員IDなど"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button type="submit" className="w-full">
            ログイン
          </Button>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            アカウントをお持ちでないですか？{" "}
            <Link
              href="/signup" // TODO: 新規アカウント作成ページへのパス
              className="text-primary hover:text-primary/80 underline"
            >
              新規作成
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
