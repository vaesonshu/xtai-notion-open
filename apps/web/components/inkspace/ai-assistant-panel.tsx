"use client"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type Message = { role: "user" | "assistant"; content: string }

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-[#242321] prose-pre:p-3 prose-pre:text-[#F7F5EF] prose-a:text-[#24866B] prose-a:underline max-w-none text-[#373532]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const language = /language-(\w+)/.exec(className ?? "")?.[1]
            if (!language) {
              return <code className={className}>{children}</code>
            }
            return (
              <div
                data-testid="ai-code-block"
                className="overflow-hidden rounded-lg"
              >
                <div
                  data-testid="ai-code-language"
                  className="bg-[#30302E] px-3 py-1 text-[11px] text-[#B8B5AC]"
                >
                  {language}
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    padding: "0.75rem",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export type AiAssistantPanelProps = {
  open: boolean
  onClose: () => void
  apiUrl: string
  documentId: string
  userId: string
  getDocumentText: () => string
}

const QUICK_ACTIONS = ["总结文档", "提取待办", "生成文档大纲"]

export function AiAssistantPanel(props: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [answerStarted, setAnswerStarted] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (props.open) inputRef.current?.focus()
    else {
      abortRef.current?.abort()
      setMessages([])
      setInput("")
    }
  }, [props.open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "end",
    })
  }, [messages, streaming])

  if (!props.open) return null

  async function send(question: string) {
    const content = question.trim()
    if (!content || streaming) return
    const history = messages
    setMessages([...history, { role: "user", content }])
    setInput("")
    setStreaming(true)
    setAnswerStarted(false)
    const controller = new AbortController()
    abortRef.current = controller
    let answer = ""
    try {
      const response = await fetch(
        `${props.apiUrl.replace(/\/$/, "")}/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-dev-user-id": props.userId,
          },
          body: JSON.stringify({
            documentId: props.documentId,
            documentText: props.getDocumentText(),
            messages: [...history, { role: "user", content }],
          }),
          signal: controller.signal,
        }
      )
      if (!response.ok || !response.body) throw new Error("AI 服务暂不可用")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const next = await reader.read()
        if (next.done) break
        buffer += decoder.decode(next.value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""
        for (const event of events) {
          const data = event
            .split("\n")
            .find((line) => line.startsWith("data: "))
          if (!data) continue
          const payload = JSON.parse(data.slice(6)) as {
            type: string
            content?: string
            message?: string
          }
          if (payload.type === "token") {
            setAnswerStarted(true)
            answer += payload.content ?? ""
            setMessages([
              ...history,
              { role: "user", content },
              { role: "assistant", content: answer },
            ])
          }
          if (payload.type === "error")
            throw new Error(payload.message ?? "AI 服务暂不可用")
        }
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        const message =
          caught instanceof Error ? caught.message : "AI 服务暂不可用"
        toast.error(message, {
          action: {
            label: "重试",
            onClick: () => void send(content),
          },
        })
      }
    } finally {
      setStreaming(false)
      setAnswerStarted(false)
      abortRef.current = null
    }
  }

  return (
    <aside
      className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-[min(420px,100vw)] min-w-0 flex-col border-l border-[#E8E6E1] bg-white"
      aria-label="AI 协作助手"
    >
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-semibold">AI 协作助手</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onClose}
          aria-label="关闭 AI 面板"
        >
          关闭
        </Button>
      </div>
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#FCFCFA] p-4"
        data-testid="ai-message-scroll"
      >
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                className="rounded-full border-[#D8D2C4] bg-white text-xs text-[#5E625D]"
                onClick={() => void send(action)}
              >
                {action}
              </Button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                message.role === "user"
                  ? "rounded-br-md bg-[#D9F0E3] whitespace-pre-wrap text-[#24543F]"
                  : "rounded-bl-md border border-[#E8E6E1] bg-white text-[#373532]"
              }`}
            >
              {message.role === "assistant" ? (
                <AssistantMarkdown content={message.content} />
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        {streaming && !answerStarted && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#E8E6E1] bg-white px-3.5 py-2.5 text-sm text-[#8A857B] shadow-sm">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-1.5 animate-pulse rounded-full bg-[#78B596] motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </span>
              正在思考…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
      <div className="border-t p-4">
        <Textarea
          ref={inputRef}
          value={input}
          disabled={streaming}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void send(input)
            }
          }}
          placeholder="询问当前文档..."
          aria-label="AI 问题输入框"
        />
        <Button
          className="mt-2 w-full"
          onClick={() =>
            streaming ? abortRef.current?.abort() : void send(input)
          }
        >
          {streaming ? "停止生成" : "发送"}
        </Button>
      </div>
    </aside>
  )
}
