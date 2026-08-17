"use client"

import type { EditorDocument } from "@workspace/editor"
import { DocumentEditor } from "@workspace/editor/components"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { XIcon } from "@workspace/icons"
import Link from "next/link"
import Image from "next/image"
import { ArticleComments } from "./article-comments"
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react"

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

function AuthorAvatar({ name, color }: { name: string; color: string }) {
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

function ArticleImageLightbox({
  src,
  onClose,
}: {
  src: string
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-4 right-4 text-white hover:bg-white/15 hover:text-white"
        aria-label="关闭图片预览"
        onClick={onClose}
      >
        <XIcon />
      </Button>
      {/* 阻止点击图片时关闭遮罩；unoptimized 以支持任意 COS 外链 */}
      <div
        className="relative h-[90vh] w-full max-w-[96vw]"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={src}
          alt="放大预览"
          fill
          unoptimized
          sizes="96vw"
          className="rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  )
}

export function ArticleReader({ article }: { article: ArticleReaderArticle }) {
  const authorName = article.author ?? "匿名作者"
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null)

  function handleContentClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) {
      return
    }
    if (!target.closest(".ProseMirror")) {
      return
    }
    const src = target.currentSrc || target.src
    if (src) {
      setPreviewImageSrc(src)
    }
  }

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
          <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
            {article.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
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

        <div
          className="mt-3 [&_[aria-label='正在加载编辑器']]:px-0 [&_[aria-label='正在加载编辑器']]:py-3"
          onClick={handleContentClick}
        >
          <DocumentEditor
            key={article.id}
            content={article.content}
            editable={false}
            className="article-reader"
          />
        </div>

        <ArticleComments articleId={article.id} />
      </article>

      {previewImageSrc ? (
        <ArticleImageLightbox
          src={previewImageSrc}
          onClose={() => setPreviewImageSrc(null)}
        />
      ) : null}
    </main>
  )
}
