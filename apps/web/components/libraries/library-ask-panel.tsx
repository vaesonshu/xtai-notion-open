"use client"

import { useRef, useState } from "react"
import { MessageSquareIcon, SendIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { askLibraryQuestion, type LibraryCitation } from "@/lib/library-api"
import { toastError } from "@/lib/toast"

type ChatTurn = {
  role: "user" | "assistant"
  content: string
  citations?: LibraryCitation[]
  pendingSourceCount?: number
}

/** 资料库问答：右侧主对话区，引用卡片 + 底部输入（类似主流知识库助手）。 */
export function LibraryAskPanel({
  libraryId,
  userId,
  embeddingHint = null,
  readySourceCount = 0,
}: {
  libraryId: string
  userId: string
  embeddingHint?: string | null
  readySourceCount?: number
}) {
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function handleAsk() {
    const content = question.trim()
    if (!content || streaming) return
    setStreaming(true)
    setQuestion("")
    setTurns((current) => [...current, { role: "user", content }])

    let citations: LibraryCitation[] = []
    let pendingSourceCount = 0
    let answer = ""

    try {
      for await (const event of askLibraryQuestion(libraryId, userId, [
        { role: "user", content },
      ])) {
        if (event.type === "citations") {
          citations = event.citations
          pendingSourceCount = event.pendingSourceCount
        }
        if (event.type === "token") {
          answer += event.content ?? ""
          setTurns((current) => {
            const next = [...current]
            const last = next[next.length - 1]
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: answer,
                citations,
                pendingSourceCount,
              }
              return next
            }
            next.push({
              role: "assistant",
              content: answer,
              citations,
              pendingSourceCount,
            })
            return next
          })
        }
        if (event.type === "error") {
          throw new Error(event.message)
        }
      }

      if (!answer) {
        setTurns((current) => [
          ...current,
          {
            role: "assistant",
            content: "",
            citations,
            pendingSourceCount,
          },
        ])
      }
    } catch (error) {
      toastError(error, "问答失败")
      setTurns((current) => current.slice(0, -1))
      setQuestion(content)
    } finally {
      setStreaming(false)
      const scrollEl = scrollRef.current
      if (scrollEl && typeof scrollEl.scrollTo === "function") {
        scrollEl.scrollTo({
          top: scrollEl.scrollHeight,
          behavior: "smooth",
        })
      }
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#FCFCFA]">
      <div className="shrink-0 border-b border-[#ECEAE4] bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-[#242321]">智能问答</h2>
        <p className="mt-0.5 text-xs text-[#78746C]">
          仅根据已索引片段回答，并展示引用来源
        </p>
      </div>

      {embeddingHint ? (
        <p className="shrink-0 border-b border-[#ECEAE4] bg-[#FFF8E6] px-4 py-2 text-sm text-[#8A6D1D]">
          {embeddingHint}
        </p>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#F3F2EE]">
              <MessageSquareIcon className="size-6 text-[#78746C]" />
            </div>
            <p className="mt-4 text-sm font-medium text-[#373532]">
              {readySourceCount > 0
                ? "向资料库提问，获取带引用的回答"
                : "先添加并索引知识来源"}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-[#78746C]">
              检索只使用最新一条问题；未命中时会返回固定提示，不会调用对话模型。
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={
                  turn.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                {turn.role === "user" ? (
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[#242321] px-4 py-2.5 text-sm leading-6 text-white">
                    {turn.content}
                  </p>
                ) : (
                  <div className="w-full max-w-3xl space-y-3">
                    {turn.citations && turn.citations.length > 0 ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {turn.citations.map((citation) => (
                          <li
                            key={`${citation.sourceId}-${citation.index}`}
                            className="rounded-xl border border-[#ECEAE4] bg-white px-3 py-2.5 text-left shadow-sm"
                          >
                            <div className="flex items-center gap-2 text-xs text-[#78746C]">
                              <span className="font-semibold text-[#24866B]">
                                [{citation.index}]
                              </span>
                              <span className="truncate font-medium text-[#373532]">
                                {citation.sourceTitle}
                              </span>
                              <span className="ml-auto shrink-0">
                                {Math.round(citation.similarity * 100)}%
                              </span>
                            </div>
                            {citation.heading ? (
                              <p className="mt-1 text-[11px] text-[#78746C]">
                                {citation.heading}
                                {citation.page != null
                                  ? ` · 第 ${citation.page} 页`
                                  : null}
                              </p>
                            ) : null}
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#78746C]">
                              {citation.excerpt}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {turn.pendingSourceCount != null &&
                    turn.pendingSourceCount > 0 ? (
                      <p className="text-xs text-[#78746C]">
                        {turn.pendingSourceCount} 个来源未参与本次回答
                      </p>
                    ) : null}
                    {turn.content ? (
                      // [1] 必须保持字面文本，不能走 Markdown，否则会被当成引用定义消掉。
                      <p className="rounded-2xl rounded-bl-md border border-[#ECEAE4] bg-white px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-[#373532]">
                        {turn.content}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#ECEAE4] bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <Textarea
            className="max-h-32 min-h-[44px] resize-none py-2.5"
            placeholder="向资料库提问"
            value={question}
            disabled={streaming}
            rows={1}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void handleAsk()
              }
            }}
          />
          <Button
            className="h-11 shrink-0 px-3"
            onClick={() => void handleAsk()}
            disabled={streaming || !question.trim()}
            aria-label={streaming ? "回答中" : "提问"}
          >
            {streaming ? (
              <span className="text-sm">…</span>
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-[#78746C]">
          Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </section>
  )
}
