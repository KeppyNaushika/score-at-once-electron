"use client"

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
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function SignupForm() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("パスワードが一致しません")
      return
    }

    if (formData.password.length < 6) {
      setError("パスワードは6文字以上で入力してください")
      return
    }

    setIsLoading(true)

    try {
      const result = await window.electronAPI.createUser({
        username: formData.username,
        password: formData.password,
        name: formData.name,
        role: "teacher",
      })

      if (result.success && result.user && result.token) {
        localStorage.setItem("authToken", result.token)
        toast.success("アカウントを作成しました")
        router.push("/dashboard")
      } else {
        setError(result.error || "アカウントの作成に失敗しました")
      }
    } catch (err) {
      setError("アカウント作成中にエラーが発生しました")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">アカウント作成</CardTitle>
        <CardDescription>新しいアカウントを作成してください。</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">氏名</Label>
            <Input
              id="name"
              type="text"
              placeholder="山田 太郎"
              required
              value={formData.name}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              type="text"
              placeholder="yamada_t"
              required
              value={formData.username}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={handleChange}
            />
            <p className="text-muted-foreground text-xs">
              6文字以上で入力してください
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">パスワード（確認）</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "作成中..." : "アカウントを作成"}
          </Button>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            既にアカウントをお持ちですか？{" "}
            <Link
              href="/login"
              className="text-primary hover:text-primary/80 underline"
            >
              ログイン
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
