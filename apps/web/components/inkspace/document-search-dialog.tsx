"use client"

import { FileTextIcon } from "@workspace/icons"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { useEffect, useState } from "react"

export type SearchDocument = {
  id: string
  title: string
}

type DocumentSearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: readonly SearchDocument[]
  apiUrl: string
  userId: string
  onSelect: (id: string) => void
}

/** ⌘K 文档搜索：优先本地标题过滤，输入时同步请求服务端 search API */
export function DocumentSearchDialog({
  open,
  onOpenChange,
  documents,
  apiUrl,
  userId,
  onSelect,
}: DocumentSearchDialogProps) {
  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState<SearchDocument[]>([])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setRemote([])
    }
  }, [open])

  useEffect(() => {
    if (!open || !apiUrl) return
    const trimmed = query.trim()
    if (!trimmed) {
      setRemote([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      void fetch(
        `${apiUrl.replace(/\/$/, "")}/documents/search?q=${encodeURIComponent(trimmed)}`,
        {
          credentials: "include",
          headers: { "x-dev-user-id": userId },
          signal: controller.signal,
        }
      )
        .then((response) => (response.ok ? response.json() : []))
        .then((items: Array<{ id: string; title: string }>) => {
          setRemote(
            items.map((item) => ({
              id: item.id,
              title: item.title || "未命名文档",
            }))
          )
        })
        .catch(() => undefined)
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [apiUrl, open, query, userId])

  const localMatches = documents.filter((item) => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return true
    return `${item.title} ${item.id}`.toLowerCase().includes(trimmed)
  })

  const results =
    query.trim().length > 0 && remote.length > 0 ? remote : localMatches

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="搜索文档"
      description="按标题或文档 ID 搜索"
    >
      <CommandInput
        placeholder="搜索文档…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>未找到匹配的文档</CommandEmpty>
        <CommandGroup heading="文档">
          {results.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.title} ${item.id}`}
              onSelect={() => {
                onSelect(item.id)
                onOpenChange(false)
              }}
            >
              <FileTextIcon className="size-4 text-[#78746C]" />
              <span className="truncate">{item.title || "未命名文档"}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
