"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Crown, Search, Trash2, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"

import { TooltipButton } from "@/components/common/TooltipButton"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EXAM_ROLE_DESCRIPTIONS,
  EXAM_ROLE_LABELS,
  EXAM_ROLES,
  type ExamRole,
  parseExamRole,
} from "@/lib/shared/examRoles"
import {
  type ExamMemberRow,
  examMembersQuery,
  examOwnerQuery,
  examUserSearchQuery,
  type ExamUserSearchRow,
  inviteExamMemberMutation,
  removeExamMemberMutation,
  setExamMemberExportPermissionMutation,
} from "@/queries/userExam"

import { AnonymousScoringSection } from "./AnonymousScoringSection"
import { MemberRoleSelect } from "./MemberRoleSelect"

interface MemberInviteDialogProps {
  isOpen: boolean
  onClose: () => void
  examId: string
  currentUserId: string
  examName?: string
}

/**
 * 試験メンバー管理ダイアログ（docs/scoring-scope-and-permissions-design.md §3-3）
 * - 現在のメンバー一覧表示
 * - ユーザー検索・招待（招待するときの役割を選ぶ）
 * - 役割の変更（オーナー・採点者・閲覧者。オーナーを別の教員へ移すのもここ）
 * - 採点者ごとの結果出力の許可（既定は許可）
 * - メンバー削除（最後の1人のオーナーは外せない）
 */
/** 未検索のときに毎回新しい配列を作らないための空値 */
const EMPTY_MEMBERS: ExamMemberRow[] = []
const EMPTY_SEARCH_RESULTS: ExamUserSearchRow[] = []

export function MemberInviteDialog({
  isOpen,
  onClose,
  examId,
  currentUserId,
  examName,
}: MemberInviteDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  /** 入力の落ち着きを待った検索語。これがクエリキーになる */
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const inviteMember = useMutation(inviteExamMemberMutation(examId))
  const removeMember = useMutation(
    removeExamMemberMutation(examId, currentUserId)
  )
  const setExportPermission = useMutation(
    setExamMemberExportPermissionMutation(examId)
  )
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)
  /** 招待するときの役割。多いのは採点を頼む場合なので採点者から始める */
  const [inviteRole, setInviteRole] = useState<ExamRole>("EDITOR")
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  // ダイアログを閉じている間は取りに行かない（開くたびに取り直す）
  const {
    data: members = EMPTY_MEMBERS,
    isPending: loading,
    error: membersError,
  } = useQuery({
    ...examMembersQuery(examId),
    enabled: isOpen && Boolean(examId),
  })
  /** 招待・削除の失敗。取得の失敗は useQuery が持つ */
  const [mutationError, setMutationError] = useState<string | null>(null)
  const error =
    mutationError ?? (membersError ? "メンバー情報の取得に失敗しました" : null)
  const ownerCount = members.filter((member) => member.role === "OWNER").length

  const { data: isOwner = false } = useQuery({
    ...examOwnerQuery(examId, currentUserId),
    enabled: isOpen && Boolean(examId),
  })

  const {
    data: searchResults = EMPTY_SEARCH_RESULTS,
    isFetching: isSearching,
  } = useQuery({
    ...examUserSearchQuery(examId, debouncedQuery),
    enabled: isOpen && Boolean(examId) && Boolean(debouncedQuery),
  })

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
      await inviteMember.mutateAsync({
        examId,
        userId,
        invitedBy: currentUserId,
        role: inviteRole,
      })
      // 招待した人は候補から外れるので、検索語ごと畳んで一覧へ戻す
      setSearchQuery("")
      setMutationError(null)
    } catch {
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
      await removeMember.mutateAsync(userId)
    } catch {
      setMutationError("メンバーの削除に失敗しました")
    } finally {
      setRemovingUserId(null)
    }
  }

  // ロールに応じたバッジを表示
  const getRoleBadge = (role: ExamRole | null) => {
    if (role === "OWNER") {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Crown className="h-3 w-3" />
          オーナー
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        {role ? EXAM_ROLE_LABELS[role] : "不明"}
      </Badge>
    )
  }

  /**
   * 結果出力の欄。許可を切り替えられるのは採点者の行だけで、オーナーと閲覧者はいつでも使える。
   * 切り替えはオーナーだけ（ほかの人には許可の有無だけを見せる）
   */
  const renderExportPermission = (member: ExamMemberRow) => {
    if (parseExamRole(member.role) !== "EDITOR") {
      return <span className="text-sm text-muted-foreground">いつでも可</span>
    }
    if (!isOwner) {
      return (
        <span className="text-sm text-muted-foreground">
          {member.canExportResults ? "可" : "不可"}
        </span>
      )
    }
    return (
      <Switch
        checked={member.canExportResults}
        onCheckedChange={(checked) =>
          setExportPermission.mutate({
            userId: member.user.id,
            canExportResults: checked,
          })
        }
        disabled={setExportPermission.isPending}
        aria-label={`${member.user.name}の結果出力`}
      />
    )
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
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ユーザー名または名前で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole(parseExamRole(value) ?? "EDITOR")
                }
              >
                <SelectTrigger className="w-32" aria-label="招待するときの役割">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {EXAM_ROLE_LABELS[role]}として
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        {/* 匿名採点の固定（オーナーだけが変えられる。ほかの人には状態だけを見せる） */}
        <AnonymousScoringSection
          examId={examId}
          members={members}
          canManage={isOwner}
        />

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
                    <TableHead>結果出力</TableHead>
                    <TableHead>招待日</TableHead>
                    {isOwner && <TableHead className="w-12"></TableHead>}
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
                          {isOwner ? (
                            <MemberRoleSelect
                              examId={examId}
                              member={member}
                              currentUserId={currentUserId}
                              ownerCount={ownerCount}
                            />
                          ) : (
                            getRoleBadge(parseExamRole(member.role))
                          )}
                        </TableCell>
                        <TableCell>{renderExportPermission(member)}</TableCell>
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
                            <div className="flex items-center justify-end gap-1">
                              {/* 最後の1人のオーナーは外せない（オーナーの居ない試験が残る） */}
                              {!(
                                member.role === "OWNER" && ownerCount <= 1
                              ) && (
                                <TooltipButton
                                  label="メンバーから外す"

                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemove(member.user.id)}
                                  disabled={removingUserId === member.user.id}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </TooltipButton>
                              )}
                            </div>
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
            {EXAM_ROLES.map((role) => (
              <li key={role}>
                <strong>{EXAM_ROLE_LABELS[role]}</strong>:{" "}
                {EXAM_ROLE_DESCRIPTIONS[role]}
              </li>
            ))}
            <li>
              採点者の結果出力は、最初は許可されています。採点者に結果を見せたくないときは「結果出力」を切ってください
            </li>
            <li>
              オーナーを別の教員へ移すときは、相手の役割を「オーナー」にしてから、自分の役割を変える
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
