/** 知识库 URL 短名：小写、数字与连字符，2–48 字符。 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugifyWorkspaceName(name: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  if (slug.length < 2) {
    slug = "workspace"
  }
  return slug.slice(0, 48)
}

export function isWorkspaceSlug(value: string): boolean {
  return (
    value.length >= 2 &&
    value.length <= 48 &&
    SLUG_PATTERN.test(value)
  )
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
