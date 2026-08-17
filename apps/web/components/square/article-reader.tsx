"use client"

import type { EditorDocument } from "@workspace/editor"
import { DocumentEditor } from "@workspace/editor/components"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import Link from "next/link"

export type ArticleReaderArticle = {
  id: string
  title: string
  author: string | null
  authorColor: string | null
  publishedAt: string
  category: string
  excerpt?: string
  content: EditorDocument
}

const DEFAULT_AUTHOR_COLOR = "#242321"

function formatPublishedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getAuthorInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function MetaDivider() {
  return (
    <span className="text-muted-foreground/40" aria-hidden="true">
      ·
    </span>
  )
}

function AuthorAvatar({
  name,
  color,
}: {
  name: string
  color: string
}) {
  const accent = color || DEFAULT_AUTHOR_COLOR

  return (
    <Avatar size="sm" style={{ backgroundColor: `${accent}20` }}>
      <AvatarFallback
        className="text-[11px] font-medium"
        style={{ color: accent }}
      >
        {getAuthorInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function ArticleReader({ article }: { article: ArticleReaderArticle }) {
  const authorName = article.author ?? "匿名作者"

  return (
    <main className="min-h-screen bg-background px-6 py-7 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/square"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 返回写作广场
        </Link>

        <header className="mt-5 border-b border-border/60 pb-4">
          <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            {article.title}
          </h1>
          <div
            className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <AuthorAvatar
                name={authorName}
                color={article.authorColor ?? DEFAULT_AUTHOR_COLOR}
              />
              <span className="font-medium text-foreground">{authorName}</span>
            </div>
            <MetaDivider />
            <span className="rounded-full border border-border px-2 py-0.5 text-xs">
              {article.category}
            </span>
            <MetaDivider />
            <time dateTime={article.publishedAt}>
              {formatPublishedAt(article.publishedAt)}
            </time>
          </div>
        </header>

        <div className="mt-3 [&_[aria-label='正在加载编辑器']]:px-0 [&_[aria-label='正在加载编辑器']]:py-3">
          <DocumentEditor
            key={article.id}
            content={article.content}
            editable={false}
            className="article-reader"
          />
        </div>
      </article>
    </main>
  )
}
