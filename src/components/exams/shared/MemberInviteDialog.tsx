"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { Crown, Search, Trash2, UserPlus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UserRole } from "@/electron-src/lib/prisma/userExam"
import { queryKeys } from "@/lib/queryKeys"

interface MemberInviteDialogProps {
  isOpen: boolean
  onClose: () => void
  examId: string
  currentUserId: string
  examName?: string
}

interface SearchResult {
  id: string
  username: string
  name: string
}

/**
 * 試験メンバー管理ダイアログ
 * - 現在のメンバー一覧表示
 * - ユーザー検索・招待
 * - メンバー削除（GRADERのみ）
 */
/** 未検索のときに毎回新しい配列を作らないための空値 */
const EMPTY_SEARCH_RESULTS: SearchResult[] = []

export function MemberInviteDialog({
  isOpen,
  onClose,
  examId,
  currentUserId,
  examName,
}: MemberInviteDialogProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  /** 入力の落ち着きを待った検索語。これがクエリキーになる */
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  // ダイアログを閉じている間は取りに行かない（開くたびに取り直す）
  const membersKey = queryKeys.exam.members(examId)
  const {
    data: members = [],
    isPending: loading,
    error: membersError,
  } = useQuery({
    queryKey: membersKey,
    queryFn:
      isOpen && examId
        ? () => window.electronAPI.userExam.getMembers(examId)
        : skipToken,
  })
  /** 招待・削除の失敗。取得の失敗は useQuery が持つ */
  const [mutationError, setMutationError] = useState<string | null>(null)
  const error =
    mutationError ?? (membersError ? "メンバー情報の取得に失敗しました" : null)

  const { data: isOwner = false } = useQuery({
    queryKey: queryKeys.exam.owner(examId, currentUserId),
    queryFn:
      isOpen && examId && currentUserId
        ? () => window.electronAPI.userExam.isOwner(currentUserId, examId)
        : skipToken,
  })

  const {
    data: searchResults = EMPTY_SEARCH_RESULTS,
    isFetching: isSearching,
  } = useQuery({
    queryKey: queryKeys.exam.userSearch(examId, debouncedQuery),
    queryFn:
      isOpen && examId && debouncedQuery
        ? () => window.electronAPI.userExam.searchUsers(examId, debouncedQuery)
        : skipToken,
  })

  const fetchMembers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: membersKey }),
    [queryClient, membersKey]
  )

  // 入力が落ち着いてから検索する（打鍵ごとに問い合わせない）
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // メンバーを招待
  const handleInvite = async (userId: string) => {
    if (!isOwner) return

    setInvitingUserId(userId)
    try {
      await window.electronAPI.userExam.invite({
        examId,
        userId,
        invitedBy: currentUserId,
      })
      await fetchMembers()
      // 招待した人は候補から外れるので、検索語ごと畳んで一覧へ戻す
      setSearchQuery("")
      setMutationError(null)
    } catch (err) {
      console.error("Failed to invite user:", err)
      setMutationError("招待に失敗しました")
    } finally {
      setInvitingUserId(null)
    }
  }

  // メンバーを削除
  const handleRemove = async (userId: string) => {
    if (!isOwner) return

    setRemovingUserId(userId)
    try {
      await window.electronAPI.userExam.remove(examId, userId, currentUserId)
      await fetchMembers()
    } catch (err) {
      console.error("Failed to remove member:", err)
      setMutationError("メンバーの削除に失敗しました")
    } finally {
      setRemovingUserId(null)
    }
  }

  // ロールに応じたバッジを表示
  const getRoleBadge = (role: UserRole) => {
    if (role === "OWNER") {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Crown className="h-3 w-3" />
          オーナー
        </Badge>
      )
    }
    return <Badge variant="secondary">採点者</Badge>
  }

  // ユーザーのイニシャルを取得
  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>試験メンバー管理</DialogTitle>
          <DialogDescription>
            {examName
              ? `「${examName}」のメンバーを管理します`
              : "試験のメンバーを管理します"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 招待セクション（オーナーのみ） */}
        {isOwner && (
          <div className="space-y-2">
            <label className="text-sm font-medium">メンバーを招待</label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ユーザー名または名前で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 検索結果 */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-50 overflow-auto rounded-md border">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between border-b p-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          @{user.username}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInvite(user.id)}
                      disabled={invitingUserId === user.id}
                    >
                      <UserPlus className="mr-1 h-4 w-4" />
                      {invitingUserId === user.id ? "招待中..." : "招待"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                検索中...
              </div>
            )}

            {searchQuery.trim() &&
              !isSearching &&
              searchResults.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  該当するユーザーが見つかりません
                </div>
              )}
          </div>
        )}

        {/* メンバー一覧 */}
        <div className="mt-4 min-w-0">
          <label className="text-sm font-medium">
            現在のメンバー ({members.length}名)
          </label>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              読み込み中...
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              メンバーがいません
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ユーザー</TableHead>
                    <TableHead>ロール</TableHead>
                    <TableHead>招待日</TableHead>
                    {isOwner && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...members]
                    .sort((memberA, memberB) => {
                      if (memberA.role === "OWNER" && memberB.role !== "OWNER")
                        return -1
                      if (memberA.role !== "OWNER" && memberB.role === "OWNER")
                        return 1
                      return 0
                    })
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {member.user.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @{member.user.username}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(member.role as UserRole)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(member.invitedAt).toLocaleDateString(
                            "ja-JP"
                          )}
                          {member.inviter && (
                            <span className="ml-1">
                              ({member.inviter.name}から)
                            </span>
                          )}
                        </TableCell>
                        {isOwner && (
                          <TableCell>
                            {member.role !== "OWNER" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemove(member.user.id)}
                                disabled={removingUserId === member.user.id}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ヘルプテキスト */}
        <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <p className="font-medium">ロールについて</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              <strong>オーナー</strong>:
              試験設定の変更、メンバーの招待・削除が可能
            </li>
            <li>
              <strong>採点者</strong>: 採点作業、結果出力が可能
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
