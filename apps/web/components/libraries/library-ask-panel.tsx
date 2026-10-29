"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { askLibraryQuestion, type LibraryCitation } from "@/lib/library-api"
import { toastError } from "@/lib/toast"

/** 资料库问答：复用 AI 助手的 SSE 分帧，把 citations/token 拼到面板上。 */
export function LibraryAskPanel({
  libraryId,
  userId,
  embeddingHint = null,
}: {
  libraryId: string
  userId: string
  embeddingHint?: string | null
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [citations, setCitations] = useState<LibraryCitation[]>([])
  const [pendingSourceCount, setPendingSourceCount] = useState(0)
  const [streaming, setStreaming] = useState(false)

  async function handleAsk() {
    const content = question.trim()
    if (!content || streaming) return
    setStreaming(true)
    setAnswer("")
    setCitations([])
    setPendingSourceCount(0)
    try {
      for await (const event of askLibraryQuestion(libraryId, userId, [
        { role: "user", content },
      ])) {
        if (event.type === "citations") {
          setCitations(event.citations)
          setPendingSourceCount(event.pendingSourceCount)
        }
        if (event.type === "token") {
          setAnswer((current) => current + (event.content ?? ""))
        }
        if (event.type === "error") {
          throw new Error(event.message)
        }
      }
    } catch (error) {
      toastError(error, "问答失败")
    } finally {
      setStreaming(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <h2 className="text-sm font-semibold text-[#78746C]">问答</h2>
      {embeddingHint ? (
        <p className="text-sm text-[#78746C]">{embeddingHint}</p>
      ) : null}
      <Textarea
        placeholder="向资料库提问"
        value={question}
        disabled={streaming}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            void handleAsk()
          }
        }}
      />
      <div className="flex justify-end">
        <Button onClick={() => void handleAsk()} disabled={streaming}>
          {streaming ? "回答中…" : "提问"}
        </Button>
      </div>
      {citations.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-[#ECEAE4] bg-white px-4 py-3 text-sm">
          {citations.map((citation) => (
            <li key={`${citation.sourceId}-${citation.index}`}>
              <span>{citation.sourceTitle}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {pendingSourceCount > 0 ? (
        <p className="text-xs text-[#78746C]">
          {pendingSourceCount} 个来源未参与本次回答
        </p>
      ) : null}
      {answer ? (
        // [1] 必须保持字面文本，不能走 Markdown，否则会被当成引用定义消掉。
        <p className="rounded-xl border border-[#ECEAE4] bg-white px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-[#373532]">
          {answer}
        </p>
      ) : null}
    </section>
  )
}
