"use client"

import { useAuth } from "../auth-provider"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Textarea } from "@workspace/ui/components/textarea"
import { Spinner } from "@workspace/ui/components/spinner"
import Link from "next/link"
import { loadEmojiMart, preloadEmojiMart } from "../../lib/emoji-mart-loader"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { apiRequest } from "@/lib/api-client"

export type ArticleCommentNode = {
  id: string
  articleId: string
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: string
  replies: ArticleCommentNode[]
}

const DEFAULT_AUTHOR_COLOR = "#242321"
const MAX_COMMENT_DEPTH = 3

function formatCommentTime(value: string): string {
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

function CommentEmojiPicker({
  onEmojiSelect,
}: {
  onEmojiSelect: (emoji: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 回调放 ref，避免父组件重渲染时销毁并重建整个 Picker
  const onSelectRef = useRef(onEmojiSelect)
  onSelectRef.current = onEmojiSelect

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let picker: HTMLElement | undefined

    void loadEmojiMart().then(({ Picker, data }) => {
      if (cancelled || !containerRef.current) return

      picker = new Picker({
        data,
        locale: "zh",
        previewPosition: "none",
        skinTonePosition: "none",
        onEmojiSelect: (emoji: { native?: string }) => {
          if (!emoji.native) return
          onSelectRef.current(emoji.native)
        },
      }) as unknown as HTMLElement
      container.replaceChildren()
      containerRef.current.append(picker)
    })

    return () => {
      cancelled = true
      picker?.remove()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex min-h-80 min-w-72 items-center justify-center"
    >
      <span className="text-sm text-muted-foreground">加载表情…</span>
    </div>
  )
}

function CommentAuthorAvatar({ name, color }: { name: string; color: string }) {
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

function CommentComposer({
  articleId,
  parentId,
  placeholder,
  submitLabel,
  onSubmitted,
  onCancel,
}: {
  articleId: string
  parentId?: string
  placeholder: string
  submitLabel: string
  onSubmitted: () => void
  onCancel?: () => void
}) {
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  const handleEmojiSelect = useCallback((emoji: string) => {
    setBody((prev) => prev + emoji)
    setEmojiOpen(false)
  }, [])

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error("请输入评论内容")
      return
    }

    setSubmitting(true)
    try {
      const response = await apiRequest({
        path: `/square/articles/${encodeURIComponent(articleId)}/comments`,
        method: "POST",
        sameOrigin: true,
        json: {
          body: trimmed,
          parentId: parentId ?? undefined,
        },
      })
      const payload = (await response.json().catch(() => null)) as {
        message?: string
      } | null

      if (response.status === 401) {
        toast.error("请先登录后再评论")
        return
      }
      if (!response.ok) {
        throw new Error(payload?.message || "发表评论失败")
      }

      setBody("")
      onSubmitted()
      toast.success(parentId ? "回复已发布" : "评论已发布")
    } catch (error) {
      toastError(error, "发表评论失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={submitting}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onMouseEnter={preloadEmojiMart}
                onFocus={preloadEmojiMart}
              >
                表情
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            {emojiOpen ? (
              <CommentEmojiPicker onEmojiSelect={handleEmojiSelect} />
            ) : null}
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="sm"
          disabled={submitting || !body.trim()}
          onClick={() => void handleSubmit()}
        >
          {submitting ? <Spinner className="size-4" /> : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={onCancel}
          >
            取消
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  articleId,
  onRefresh,
}: {
  comment: ArticleCommentNode
  articleId: string
  onRefresh: () => void
}) {
  const { user, loading: authLoading } = useAuth()
  const [replyOpen, setReplyOpen] = useState(false)
  const canReply = comment.depth < MAX_COMMENT_DEPTH

  return (
    <article className="space-y-3">
      <div className="flex gap-3">
        <CommentAuthorAvatar
          name={comment.authorName}
          color={comment.authorColor}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium text-foreground">
              {comment.authorName}
            </span>
            <time
              className="text-xs text-muted-foreground"
              dateTime={comment.createdAt}
            >
              {formatCommentTime(comment.createdAt)}
            </time>
          </div>
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
            {comment.body}
          </p>
          {canReply && !authLoading ? (
            user ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setReplyOpen((open) => !open)}
              >
                {replyOpen ? "收起回复" : "回复"}
              </Button>
            ) : null
          ) : null}
        </div>
      </div>

      {replyOpen && user ? (
        <div className="ml-9">
          <CommentComposer
            articleId={articleId}
            parentId={comment.id}
            placeholder={`回复 ${comment.authorName}…`}
            submitLabel="发表回复"
            onSubmitted={() => {
              setReplyOpen(false)
              onRefresh()
            }}
            onCancel={() => setReplyOpen(false)}
          />
        </div>
      ) : null}

      {comment.replies.length > 0 ? (
        <div className="ml-9 space-y-4 border-l border-border/60 pl-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              articleId={articleId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function ArticleComments({ articleId }: { articleId: string }) {
  const { user, loading: authLoading } = useAuth()
  const [comments, setComments] = useState<ArticleCommentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadComments = useCallback(async () => {
    setError(null)
    try {
      const response = await apiRequest({
        path: `/square/articles/${encodeURIComponent(articleId)}/comments`,
        sameOrigin: true,
      })
      if (!response.ok) {
        throw new Error("加载评论失败")
      }
      const body = (await response.json()) as ArticleCommentNode[]
      setComments(body)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "加载评论失败"
      toastError(caught, "加载评论失败")
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    void loadComments()
    preloadEmojiMart()
  }, [loadComments])

  const loginHref = `/login?returnTo=${encodeURIComponent(
    `/square/${articleId}`
  )}`

  return (
    <section
      className="mt-10 border-t border-border/60 pt-8"
      aria-label="评论区"
    >
      <h2 className="text-lg font-semibold tracking-tight">
        评论
        {!loading && comments.length > 0 ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {countComments(comments)}
          </span>
        ) : null}
      </h2>

      <div className="mt-4">
        {authLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            正在检查登录状态…
          </div>
        ) : user ? (
          <CommentComposer
            articleId={articleId}
            placeholder="写下你的想法，支持表情符号 😊"
            submitLabel="发表评论"
            onSubmitted={() => void loadComments()}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href={loginHref} className="text-primary hover:underline">
              登录
            </Link>
            后即可参与讨论
          </p>
        )}
      </div>

      <div className="mt-8 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            加载评论中…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无评论，来抢沙发吧</p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              articleId={articleId}
              onRefresh={() => void loadComments()}
            />
          ))
        )}
      </div>
    </section>
  )
}

function countComments(nodes: ArticleCommentNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countComments(node.replies),
    0
  )
}
