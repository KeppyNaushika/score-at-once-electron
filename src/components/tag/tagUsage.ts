import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"

/**
 * タグの利用先内訳を1行の文言にする。
 * タグ自体は用途を持たず、何を分類するタグかは付いた先で決まるため、それを可視化する。
 */
export function formatTagUsage(tag: TagWithAllRelations): string {
  const usages = [
    { label: "試験", links: tag.examTags },
    { label: "資料", links: tag.courseworkTags },
    { label: "成績算出", links: tag.gradeTags },
    { label: "解答用紙定義", links: tag.asbDefinitionTags },
    { label: "小計点グループ", links: tag.tagSubtotalGroups },
  ]
    .filter((usage) => usage.links.length > 0)
    .map((usage) => `${usage.label} ${usage.links.length}`)

  return usages.length > 0 ? usages.join(" / ") : "未使用"
}
