"use client"

import { MessageSquareIcon } from "@workspace/icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useBlockEditor } from "@xtai-notion/editor-react"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import {
  type CommentTextAnchor,
  type DocumentCommentMarkEntry,
  findCommentMarkAtPos,
  setDocumentCommentMarks,
} from "@xtai-notion/editor-core"
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { PencilIcon } from "./icon"

export type DocumentCommentNode = {
  id: string
  documentId: string
  blockId: string
  anchorFrom: number | null
  anchorTo: number | null
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: string
  replies: DocumentCommentNode[]
}

/** 从评论树收集 PM 装饰所需的锚点条目 */
export function collectCommentMarks(
  comments: readonly DocumentCommentNode[]
): DocumentCommentMarkEntry[] {
  const marks: DocumentCommentMarkEntry[] = []
  const walk = (nodes: readonly DocumentCommentNode[]) => {
    for (const node of nodes) {
      marks.push({
        id: node.id,
        blockId: node.blockId,
        anchorFrom: node.anchorFrom,
        anchorTo: node.anchorTo,
      })
      walk(node.replies)
    }
  }
  walk(comments)
  return marks
}

type DocumentCommentsPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiUrl: string
  documentId: string
  userId: string
  commentAnchor: CommentTextAnchor | null
  onCommentAnchorClear: () => void
  activeCommentId: string | null
  onCommentMarksChange?: (marks: DocumentCommentMarkEntry[]) => void
  onCommentDeleted?: (commentId: string) => void
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

function truncatePreview(text: string, max = 48): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
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

function countReplies(comment: DocumentCommentNode): number {
  return comment.replies.reduce(
    (total, reply) => total + 1 + countReplies(reply),
    0
  )
}

function CommentThread({
  comment,
  userId,
  activeCommentId,
  onReply,
  onJumpToBlock,
  onDelete,
  deletingCommentId,
}: {
  comment: DocumentCommentNode
  userId: string
  activeCommentId: string | null
  onReply: (parentId: string) => void
  onJumpToBlock: (blockId: string) => void
  onDelete: (comment: DocumentCommentNode) => void
  deletingCommentId: string | null
}) {
  const canDelete = comment.authorId === userId
  const isActive = activeCommentId === comment.id

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg p-2 transition-colors",
        isActive &&
          "bg-[rgba(255,212,0,0.18)] ring-1 ring-[rgba(234,179,8,0.35)]"
      )}
      data-comment-id={comment.id}
      data-active={isActive ? "true" : undefined}
    >
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
              定位到正文
            </button>
            {canDelete ? (
              <button
                type="button"
                className="cursor-pointer text-xs text-[#78746C] hover:text-[#E64B3C] disabled:opacity-50"
                disabled={deletingCommentId === comment.id}
                onClick={() => onDelete(comment)}
              >
                {deletingCommentId === comment.id ? "删除中…" : "删除"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <ul className="ml-8 flex flex-col gap-2 border-l border-[#E8E6E1] pl-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              userId={userId}
              activeCommentId={activeCommentId}
              onReply={onReply}
              onJumpToBlock={onJumpToBlock}
              onDelete={onDelete}
              deletingCommentId={deletingCommentId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** 文档内评论侧栏：按选区锚定，支持回复与跳转到对应正文 */
export function DocumentCommentsPanel({
  open,
  onOpenChange,
  apiUrl,
  documentId,
  userId,
  commentAnchor,
  onCommentAnchorClear,
  activeCommentId,
  onCommentMarksChange,
  onCommentDeleted,
}: DocumentCommentsPanelProps) {
  const [comments, setComments] = useState<DocumentCommentNode[]>([])
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<DocumentCommentNode | null>(
    null
  )
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const baseUrl = `${apiUrl.replace(/\/$/, "")}/documents/${documentId}/comments`

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(baseUrl, {
        credentials: "include",
        headers: { "x-dev-user-id": userId },
      })
      if (!response.ok) throw new Error("加载评论失败")
      const payload = await response.json()
      const items = Array.isArray(payload)
        ? (payload as DocumentCommentNode[])
        : []
      setComments(items)
      onCommentMarksChange?.(collectCommentMarks(items))
    } catch (error) {
      toastError(error, "加载评论失败")
    } finally {
      setLoading(false)
    }
  }, [baseUrl, userId, onCommentMarksChange])

  useEffect(() => {
    void loadComments()
  }, [loadComments])

  useEffect(() => {
    if (open) void loadComments()
  }, [loadComments, open])

  useEffect(() => {
    if (!open || !activeCommentId || loading || !scrollRef.current) return

    const frame = requestAnimationFrame(() => {
      const item = scrollRef.current?.querySelector(
        `[data-comment-id="${activeCommentId}"]`
      )
      item?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeCommentId, open, loading, comments])

  const threads = useMemo(() => comments, [comments])

  const deleteReplyCount = deleteTarget ? countReplies(deleteTarget) : 0

  async function confirmDelete() {
    if (!deleteTarget || deletingCommentId) return

    const comment = deleteTarget
    setDeletingCommentId(comment.id)
    try {
      const response = await fetch(`${baseUrl}/${comment.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-dev-user-id": userId },
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(payload?.message || "删除评论失败")
      }
      if (replyParentId === comment.id) {
        setReplyParentId(null)
      }
      onCommentDeleted?.(comment.id)
      setDeleteTarget(null)
      toast.success("评论已删除")
      await loadComments()
    } catch (error) {
      toastError(error, "删除评论失败")
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function submitComment() {
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error("请输入评论内容")
      return
    }
    if (!replyParentId && !commentAnchor) {
      toast.error("请先在正文中选中要评论的文字")
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
          blockId: commentAnchor?.blockId,
          anchorFrom: commentAnchor?.anchorFrom,
          anchorTo: commentAnchor?.anchorTo,
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
      onCommentAnchorClear()
      toast.success(replyParentId ? "回复已发布" : "评论已发布")
      await loadComments()
    } catch (error) {
      toastError(error, "发表评论失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {open ? (
        <aside
          className="flex h-full min-h-0 w-[min(280px,100vw)] min-w-0 shrink-0 flex-col border-l border-[#E8E6E1] bg-white"
          aria-label="文档评论"
        >
      <div className="flex items-start justify-between gap-2 border-b border-[#E8E6E1] p-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold text-[#242321]">
            <PencilIcon icon={MessageSquareIcon} size={18} />
            文档评论
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#78746C]">
            选中正文文字后即可评论；点击划线内容可定位到对应评论。
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setDeleteTarget(null)
            onOpenChange(false)
          }}
          aria-label="关闭评论侧栏"
        >
          关闭
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
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
          ) : commentAnchor ? (
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-[#78746C]">
                评论选中：
                <span className="font-medium text-[#242321]">
                  「{truncatePreview(commentAnchor.preview)}」
                </span>
              </p>
              <button
                type="button"
                className="shrink-0 cursor-pointer text-xs text-[#78746C] underline hover:text-[#242321]"
                onClick={onCommentAnchorClear}
              >
                重选
              </button>
            </div>
          ) : (
            <p className="mb-2 text-xs text-[#9A6700]">
              请先在正文中选中要评论的文字
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
        ) : threads.length === 0 ? (
          <p className="text-sm text-[#78746C]">暂无评论</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {threads.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                userId={userId}
                activeCommentId={activeCommentId}
                onReply={setReplyParentId}
                onJumpToBlock={scrollToBlock}
                onDelete={setDeleteTarget}
                deletingCommentId={deletingCommentId}
              />
            ))}
          </ul>
        )}
      </div>
        </aside>
      ) : null}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next && !deletingCommentId) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条评论？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteReplyCount > 0
                ? `确定删除这条评论吗？其下的 ${deleteReplyCount} 条回复也会一并删除，此操作无法撤销。`
                : "确定删除这条评论吗？此操作无法撤销。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              disabled={deletingCommentId !== null}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              disabled={deletingCommentId !== null}
              onClick={() => void confirmDelete()}
            >
              {deletingCommentId ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** 通过 PM 装饰同步评论锚点样式 */
export function DocumentCommentMarkers({
  commentMarks,
  activeCommentId,
}: {
  commentMarks: readonly DocumentCommentMarkEntry[]
  activeCommentId?: string | null
}) {
  const context = use(EditorContext)
  if (!context?.blockEditor) {
    return null
  }
  return (
    <DocumentCommentMarkersReady
      commentMarks={commentMarks}
      activeCommentId={activeCommentId}
    />
  )
}

function DocumentCommentMarkersReady({
  commentMarks,
  activeCommentId,
}: {
  commentMarks: readonly DocumentCommentMarkEntry[]
  activeCommentId?: string | null
}) {
  const blockEditor = useBlockEditor()

  useEffect(() => {
    setDocumentCommentMarks(
      blockEditor,
      commentMarks,
      activeCommentId ?? null
    )
  }, [activeCommentId, blockEditor, commentMarks])

  return null
}

/** 订阅选区变化，向工作区报告当前选区锚点 */
export function DocumentCommentBridge({
  commentMarks,
  onSelectionAnchorChange,
  onCommentMarkClick,
}: {
  commentMarks: readonly DocumentCommentMarkEntry[]
  onSelectionAnchorChange: (anchor: CommentTextAnchor | null) => void
  onCommentMarkClick?: (commentId: string) => void
}) {
  const blockEditor = useBlockEditor()

  useEffect(() => {
    const syncSelectionAnchor = () => {
      const anchor = blockEditor.getCommentTextSelection()
      if (anchor) {
        onSelectionAnchorChange(anchor)
      }
    }
    syncSelectionAnchor()
    blockEditor.tiptap.on("selectionUpdate", syncSelectionAnchor)
    return () => {
      blockEditor.tiptap.off("selectionUpdate", syncSelectionAnchor)
    }
  }, [blockEditor, onSelectionAnchorChange])

  useEffect(() => {
    if (!onCommentMarkClick || commentMarks.length === 0) {
      return
    }

    const view = blockEditor.tiptap.view

    const handleClick = (event: MouseEvent) => {
      const coords = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      })
      if (!coords) return

      const mark = findCommentMarkAtPos(
        view.state.doc,
        commentMarks,
        coords.pos
      )
      if (mark) {
        onCommentMarkClick(mark.id)
      }
    }

    view.dom.addEventListener("click", handleClick)
    return () => {
      view.dom.removeEventListener("click", handleClick)
    }
  }, [blockEditor, commentMarks, onCommentMarkClick])

  return null
}
