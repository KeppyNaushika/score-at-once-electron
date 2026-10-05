import { bind } from "./invoke"

/** ユーザー-試験関連のIPC API（メンバー一覧・オーナー判定・招待・除名・役割変更・ユーザー検索） */
export function createUserExamApi() {
  return {
    // UserExam
    userExam: {
      getMembers: bind("user-exam:get-members"),
      isOwner: bind("user-exam:is-owner"),
      invite: bind("user-exam:invite"),
      remove: bind("user-exam:remove"),
      changeRole: bind("user-exam:change-role"),
      setExportPermission: bind("user-exam:set-export-permission"),
      setAnonymousScoringEnforced: bind(
        "user-exam:set-anonymous-scoring-enforced"
      ),
      searchUsers: bind("user-exam:search-users"),
    },
  }
}
