"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import type { Range } from "@tiptap/core"
import { PluginKey } from "@tiptap/pm/state"
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion"
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type VirtualElement,
} from "@floating-ui/react"
import { useEditorInstance } from "@xtai-notion/editor-react"
import {
  filterMentionItems,
  insertMention,
  type MentionableItem,
} from "@xtai-notion/editor-core"
import { useMentionProvider } from "@xtai-notion/editor-react"

const mentionMenuPluginKey = new PluginKey("mentionMenu")

type MentionSuggestionState = {
  query: string
  items: MentionableItem[]
  range: Range
  command: (item: MentionableItem) => void
}

export function MentionMenu() {
  const editor = useEditorInstance()
  const mentionProvider = useMentionProvider()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MentionableItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  // 光标处矩形，用作 floating-ui 的虚拟锚点。
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const suggestionRef = useRef<MentionSuggestionState | null>(null)
  const selectedIdRef = useRef(selectedId)
  const itemsRef = useRef(items)

  useEffect(() => {
    selectedIdRef.current = selectedId
    itemsRef.current = items
  }, [items, selectedId])

  // 将光标矩形包装为 floating-ui 的虚拟参考元素，随输入框滚动/重排自动更新。
  const virtualElement: VirtualElement | null = useMemo(
    () =>
      anchorRect
        ? {
            getBoundingClientRect: () => anchorRect,
          }
        : null,
    [anchorRect]
  )

  const { refs, floatingStyles } = useFloating<VirtualElement>({
    open,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(120, availableHeight - 8)}px`,
          })
        },
      }),
    ],
  })

  // 虚拟参考元素不是真实 DOM 节点，需通过 setReference 手动挂载。
  useEffect(() => {
    refs.setReference(virtualElement)
  }, [refs, virtualElement])

  useEffect(() => {
    if (!editor.isEditable) {
      return
    }

    const plugin = Suggestion<MentionableItem, MentionableItem>({
      pluginKey: mentionMenuPluginKey,
      editor,
      char: "@",
      startOfLine: false,
      allowedPrefixes: null,
      items: ({ query: nextQuery }) => {
        // 无 provider 时返回空数组，避免向宿主发出无意义的请求。
        if (!mentionProvider) {
          return []
        }
        return Promise.resolve(mentionProvider(nextQuery)).then((nextItems) =>
          filterMentionItems(nextItems, nextQuery)
        )
      },
      command: ({ editor: activeEditor, range, props }) => {
        insertMention(activeEditor, range, props)
      },
      render: () => {
        const sync = (
          props: SuggestionProps<MentionableItem, MentionableItem>
        ) => {
          suggestionRef.current = {
            query: props.query,
            items: props.items,
            range: props.range,
            command: props.command,
          }
          setItems(props.items)
          setSelectedId((current) =>
            props.items.some((item) => item.id === current)
              ? current
              : (props.items[0]?.id ?? "")
          )
          setAnchorRect(props.clientRect?.() ?? null)
          setOpen(true)
        }

        return {
          onStart: sync,
          onUpdate: sync,
          onExit: () => {
            suggestionRef.current = null
            setOpen(false)
            setItems([])
            setSelectedId("")
            setAnchorRect(null)
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!suggestionRef.current) {
              return false
            }

            if (event.key === "Escape") {
              exitSuggestion(editor.view, mentionMenuPluginKey)
              return true
            }

            const currentItems = itemsRef.current
            if (currentItems.length === 0) {
              return false
            }

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const index = currentItems.findIndex(
                (item) => item.id === selectedIdRef.current
              )
              const delta = event.key === "ArrowDown" ? 1 : -1
              const next =
                currentItems[
                  (index + delta + currentItems.length) % currentItems.length
                ]
              if (next) {
                setSelectedId(next.id)
              }
              return true
            }

            if (event.key === "Enter") {
              const selected =
                currentItems.find(
                  (item) => item.id === selectedIdRef.current
                ) ?? currentItems[0]
              if (selected) {
                suggestionRef.current.command(selected)
              }
              return true
            }

            return false
          },
        }
      },
    })

    editor.registerPlugin(plugin, (nextPlugin, plugins) => [
      nextPlugin,
      ...plugins,
    ])
    return () => {
      editor.unregisterPlugin(mentionMenuPluginKey)
    }
  }, [editor, mentionProvider])

  if (!editor.isEditable || !open) {
    return null
  }

  return (
    <div
      // floating-ui 的 ref 回调是稳定函数，不是 React ref.current 的读取。
      // eslint-disable-next-line react-hooks/refs
      ref={refs.setFloating}
      style={floatingStyles}
      data-testid="mention-menu"
      className="z-50 w-72 overflow-y-auto rounded-lg border border-[#E8E6E1] bg-white p-1 shadow-md"
    >
      {items.length === 0 ? (
        <div className="px-2 py-3 text-center text-sm text-[#9A9488]">
          没有匹配的文档
        </div>
      ) : (
        items.map((item) => (
          <MentionOption
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onSelect={() => {
              suggestionRef.current?.command(item)
            }}
            onHover={() => setSelectedId(item.id)}
          />
        ))
      )}
    </div>
  )
}

function MentionOption({
  item,
  selected,
  onSelect,
  onHover,
}: {
  item: MentionableItem
  selected: boolean
  onSelect: () => void
  onHover: () => void
}) {
  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
        selected
          ? "bg-[#E6F3EC] text-[#24866B]"
          : "text-[#242321] hover:bg-[#F3F2EF]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </button>
  )
}
