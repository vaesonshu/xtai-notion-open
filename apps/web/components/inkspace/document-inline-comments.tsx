"use client"

import { MessageSquareIcon } from "@workspace/icons"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { useBlockEditor } from "@xtai-notion/editor-react"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { use, useCallback, useEffect, useMemo, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { PencilIcon } from "./icon"

export type DocumentCommentNode = {
  id: string
  documentId: string
  blockId: string
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: string
  replies: DocumentCommentNode[]
}

/** 从评论树收集所有被标注的块 id */
export function collectCommentedBlockIds(
  comments: readonly DocumentCommentNode[]
): string[] {
  const ids = new Set<string>()
  const walk = (nodes: readonly DocumentCommentNode[]) => {
    for (const node of nodes) {
      ids.add(node.blockId)
      walk(node.replies)
    }
  }
  walk(comments)
  return [...ids]
}

type DocumentCommentsPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiUrl: string
  documentId: string
  userId: string
  activeBlockId: string | null
  onCommentedBlockIdsChange?: (blockIds: string[]) => void
}

const DEFAULT_AUTHOR_COLOR = "#242321"

function formatCommentTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

/** 滚动到评论锚定的块容器 */
function scrollToBlock(blockId: string): void {
  const element = document.querySelector(`[data-id="${blockId}"]`)
  element?.scrollIntoView({ behavior: "smooth", block: "center" })
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

function CommentThread({
  comment,
  onReply,
  onJumpToBlock,
}: {
  comment: DocumentCommentNode
  onReply: (parentId: string) => void
  onJumpToBlock: (blockId: string) => void
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex gap-2.5">
        <CommentAuthorAvatar
          name={comment.authorName}
          color={comment.authorColor}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#242321]">
              {comment.authorName}
            </span>
            <time
              className="text-[11px] text-[#78746C]"
              dateTime={comment.createdAt}
            >
              {formatCommentTime(comment.createdAt)}
            </time>
          </div>
          <p className="mt-1 text-sm text-[#373532]">{comment.body}</p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              className="cursor-pointer text-xs text-[#78746C] hover:text-[#242321]"
              onClick={() => onReply(comment.id)}
            >
              回复
            </button>
            <button
              type="button"
              className="cursor-pointer text-xs text-[#78746C] hover:text-[#242321]"
              onClick={() => onJumpToBlock(comment.blockId)}
            >
              定位到块
            </button>
          </div>
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <ul className="ml-8 flex flex-col gap-2 border-l border-[#E8E6E1] pl-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onJumpToBlock={onJumpToBlock}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** 文档内评论侧栏：按块锚定，支持回复与跳转到对应块 */
export function DocumentCommentsPanel({
  open,
  onOpenChange,
  apiUrl,
  documentId,
  userId,
  activeBlockId,
  onCommentedBlockIdsChange,
}: DocumentCommentsPanelProps) {
  const [comments, setComments] = useState<DocumentCommentNode[]>([])
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [replyParentId, setReplyParentId] = useState<string | null>(null)

  const baseUrl = `${apiUrl.replace(/\/$/, "")}/documents/${documentId}/comments`

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(baseUrl, {
        credentials: "include",
        headers: { "x-dev-user-id": userId },
      })
      if (!response.ok) throw new Error("加载评论失败")
      const items = (await response.json()) as DocumentCommentNode[]
      setComments(items)
      onCommentedBlockIdsChange?.(collectCommentedBlockIds(items))
    } catch (error) {
      toastError(error, "加载评论失败")
    } finally {
      setLoading(false)
    }
  }, [baseUrl, userId, onCommentedBlockIdsChange])

  // 打开文档即加载评论，以便正文显示批注标记（不仅限侧栏打开时）
  useEffect(() => {
    void loadComments()
  }, [loadComments])

  useEffect(() => {
    if (open) void loadComments()
  }, [loadComments, open])

  const grouped = useMemo(() => {
    const map = new Map<string, DocumentCommentNode[]>()
    for (const comment of comments) {
      const list = map.get(comment.blockId) ?? []
      list.push(comment)
      map.set(comment.blockId, list)
    }
    return [...map.entries()]
  }, [comments])

  async function submitComment() {
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error("请输入评论内容")
      return
    }
    if (!replyParentId && !activeBlockId) {
      toast.error("请先将光标放在要评论的段落上")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-dev-user-id": userId,
        },
        body: JSON.stringify({
          body: trimmed,
          blockId: activeBlockId ?? undefined,
          parentId: replyParentId ?? undefined,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(payload?.message || "发表评论失败")
      }
      setBody("")
      setReplyParentId(null)
      toast.success(replyParentId ? "回复已发布" : "评论已发布")
      await loadComments()
    } catch (error) {
      toastError(error, "发表评论失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PencilIcon icon={MessageSquareIcon} size={18} />
            文档评论
          </SheetTitle>
          <SheetDescription>
            将光标放在段落上即可评论该块；评论后正文会以高亮与下划线标识，点击「定位到块」可跳转。
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="rounded-lg border border-[#E8E6E1] p-3">
            {replyParentId ? (
              <p className="mb-2 text-xs text-[#78746C]">
                正在回复评论…
                <button
                  type="button"
                  className="ml-2 cursor-pointer text-[#242321] underline"
                  onClick={() => setReplyParentId(null)}
                >
                  取消
                </button>
              </p>
            ) : activeBlockId ? (
              <p className="mb-2 text-xs text-[#78746C]">
                将评论添加到当前块
              </p>
            ) : (
              <p className="mb-2 text-xs text-[#9A6700]">
                请先在正文中点击要评论的段落
              </p>
            )}
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="写下你的评论…"
              rows={3}
              className="resize-none"
            />
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={submitting}
              onClick={() => void submitComment()}
            >
              {submitting ? "发送中…" : replyParentId ? "回复" : "发表评论"}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-[#78746C]">加载中…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-[#78746C]">暂无评论</p>
          ) : (
            grouped.map(([blockId, threads]) => (
              <section key={blockId} className="flex flex-col gap-3">
                <button
                  type="button"
                  className="cursor-pointer text-left text-xs font-medium text-[#78746C] hover:text-[#242321]"
                  onClick={() => scrollToBlock(blockId)}
                >
                  块 {blockId.slice(0, 8)}…
                </button>
                <ul className="flex flex-col gap-3">
                  {threads.map((comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      onReply={setReplyParentId}
                      onJumpToBlock={scrollToBlock}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** 在编辑器 DOM 上同步评论锚点样式（块级高亮 + 下划线） */
export function DocumentCommentMarkers({
  commentedBlockIds,
  activeBlockId,
}: {
  commentedBlockIds: readonly string[]
  activeBlockId?: string | null
}) {
  const context = use(EditorContext)
  if (!context?.blockEditor) {
    return null
  }
  return (
    <DocumentCommentMarkersReady
      commentedBlockIds={commentedBlockIds}
      activeBlockId={activeBlockId}
    />
  )
}

function DocumentCommentMarkersReady({
  commentedBlockIds,
  activeBlockId,
}: {
  commentedBlockIds: readonly string[]
  activeBlockId?: string | null
}) {
  const blockEditor = useBlockEditor()

  const applyMarks = useCallback(() => {
    const marked = new Set(commentedBlockIds)
    document
      .querySelectorAll('[data-node-type="blockContainer"]')
      .forEach((element) => {
        const blockId = element.getAttribute("data-id")
        element.classList.remove(
          "document-comment-marked",
          "document-comment-marked-active"
        )
        if (!blockId || !marked.has(blockId)) return
        element.classList.add("document-comment-marked")
        if (blockId === activeBlockId) {
          element.classList.add("document-comment-marked-active")
        }
      })
  }, [activeBlockId, commentedBlockIds])

  useEffect(() => {
    applyMarks()
    return blockEditor.onChange(() => applyMarks())
  }, [applyMarks, blockEditor])

  return null
}

/** 订阅选区变化，向工作区报告当前块 id 供评论锚定 */
export function DocumentCommentBridge({
  onActiveBlockIdChange,
}: {
  onActiveBlockIdChange: (blockId: string | null) => void
}) {
  const blockEditor = useBlockEditor()

  useEffect(() => {
    const syncActiveBlock = () => {
      const blocks = blockEditor.getSelectedBlocks()
      onActiveBlockIdChange(blocks[0]?.id ?? null)
    }
    syncActiveBlock()
    blockEditor.tiptap.on("selectionUpdate", syncActiveBlock)
    return () => {
      blockEditor.tiptap.off("selectionUpdate", syncActiveBlock)
    }
  }, [blockEditor, onActiveBlockIdChange])

  return null
}
