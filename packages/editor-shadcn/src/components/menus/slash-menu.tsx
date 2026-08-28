"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Editor, Range } from "@tiptap/core"
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
  useFloating,
  type VirtualElement,
} from "@floating-ui/react"
import {
  executeSlashCommand,
  filterCommands,
  getSlashCommands,
  type SlashCommand,
} from "@xtai-notion/editor-core/slash-commands"
import type { Block, TableContent } from "@xtai-notion/editor-core/block-schema/types"
import { generateBlockId } from "@xtai-notion/editor-core/block-schema/ids"
import type { BlockEditor } from "@xtai-notion/editor-core"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
import { useImageUpload } from "../nodes/image-upload"
import { TableGridPicker } from "./table-grid-picker"

const slashMenuPluginKey = new PluginKey("slashMenu")

type SlashSuggestionState = {
  query: string
  items: SlashCommand[]
  range: Range
  command: (item: SlashCommand) => void
}

function blockHasVisibleContent(block: Block | undefined): boolean {
  if (!block?.content) return false
  if (Array.isArray(block.content)) {
    return block.content.some((item) =>
      item.type === "text" ? item.text.length > 0 : true
    )
  }
  return true
}

function createTableBlock(rows: number, cols: number): Block {
  const cell = (): { content: [] } => ({ content: [] })
  const row = () => ({
    cells: Array.from({ length: cols }, cell),
  })
  return {
    id: generateBlockId(),
    type: "table",
    props: {},
    content: {
      headerRows: 1,
      rows: Array.from({ length: rows }, row),
    } satisfies TableContent,
    children: [],
  }
}

function insertTableBlock(blockEditor: BlockEditor, rows: number, cols: number) {
  const tableBlock = createTableBlock(rows, cols)
  const selected = blockEditor.getSelectedBlocks()[0]
  if (selected && !blockHasVisibleContent(selected)) {
    blockEditor.updateBlock(selected.id, tableBlock)
  } else {
    blockEditor.insertBlocks(
      [tableBlock],
      selected?.id ?? blockEditor.document[0]!.id,
      "after"
    )
  }
}

function applySlashCommand(
  blockEditor: BlockEditor,
  range: Range,
  item: SlashCommand,
  insertImageUpload: () => void
) {
  blockEditor.tiptap.chain().focus().deleteRange(range).run()
  if (item.id === "upload-image") {
    insertImageUpload()
    return
  }
  executeSlashCommand(blockEditor, item.id)
}

export function SlashMenu() {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap
  const { canUpload, openFilePicker: insertImageUpload } = useImageUpload()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<SlashCommand[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [hoveredId, setHoveredId] = useState("")
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [tableAnchorRect, setTableAnchorRect] = useState<DOMRect | null>(null)
  const tableCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tablePinnedRef = useRef(false)
  const keyboardNavigationRef = useRef(false)
  const suggestionRef = useRef<SlashSuggestionState | null>(null)
  const insertImageUploadRef = useRef(insertImageUpload)
  const selectedIdRef = useRef(selectedId)
  const itemsRef = useRef(items)
  const menuScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    insertImageUploadRef.current = insertImageUpload
    selectedIdRef.current = selectedId
    itemsRef.current = items
  }, [insertImageUpload, items, selectedId])

  useEffect(() => {
    if (!editor.isEditable) {
      return
    }

    const plugin = Suggestion<SlashCommand, SlashCommand>({
      pluginKey: slashMenuPluginKey,
      editor,
      char: "/",
      startOfLine: true,
      allowedPrefixes: null,
      items: ({ query: nextQuery }) => {
        return filterCommands(
          getSlashCommands({ includeImageUpload: canUpload }),
          nextQuery
        )
      },
      command: ({ editor: activeEditor, range, props }) => {
        applySlashCommand(
          blockEditor,
          range,
          props,
          insertImageUploadRef.current
        )
      },
      render: () => {
        const sync = (props: SuggestionProps<SlashCommand, SlashCommand>) => {
          suggestionRef.current = {
            query: props.query,
            items: props.items,
            range: props.range,
            command: props.command,
          }
          setQuery(props.query)
          setItems(props.items)
          setAnchorRect(props.clientRect?.() ?? null)
          setSelectedId((current) =>
            props.items.some((item) => item.id === current)
              ? current
              : (props.items[0]?.id ?? "")
          )
          setOpen(true)
        }

        return {
          onStart: sync,
          onUpdate: sync,
          onExit: () => {
            suggestionRef.current = null
            setTableAnchorRect(null)
            tablePinnedRef.current = false
            setAnchorRect(null)
            setOpen(false)
            setQuery("")
            setItems([])
            setSelectedId("")
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!suggestionRef.current) {
              return false
            }

            if (event.key === "Escape") {
              tablePinnedRef.current = false
              keyboardNavigationRef.current = false
              exitSuggestion(editor.view, slashMenuPluginKey)
              return true
            }

            const currentItems = itemsRef.current
            if (currentItems.length === 0) {
              return false
            }

            if (event.key === "ArrowDown") {
              keyboardNavigationRef.current = true
              const index = currentItems.findIndex(
                (item) => item.id === selectedIdRef.current
              )
              const next = currentItems[(index + 1) % currentItems.length]
              if (next) {
                setSelectedId(next.id)
                tablePinnedRef.current = next.id === "table"
              }
              return true
            }

            if (event.key === "ArrowUp") {
              keyboardNavigationRef.current = true
              const index = currentItems.findIndex(
                (item) => item.id === selectedIdRef.current
              )
              const next =
                currentItems[
                  (index - 1 + currentItems.length) % currentItems.length
                ]
              if (next) {
                setSelectedId(next.id)
                tablePinnedRef.current = next.id === "table"
              }
              return true
            }

            if (event.key === "Enter") {
              const selected =
                currentItems.find(
                  (item) => item.id === selectedIdRef.current
                ) ?? currentItems[0]
              if (selected) {
                if (selected.id === "table") {
                  setSelectedId("table")
                  tablePinnedRef.current = true
                  const tableItem = document.querySelector<HTMLElement>(
                    '[data-slash-command="table"]'
                  )
                  if (tableItem) openTableSubmenu(tableItem)
                  return true
                }
                suggestionRef.current.command(selected)
              }
              return true
            }

            return false
          },
        }
      },
    })

    // Prepend so Arrow/Enter/Escape are handled before default keymap actions.
    editor.registerPlugin(plugin, (nextPlugin, plugins) => [
      nextPlugin,
      ...plugins,
    ])
    return () => {
      editor.unregisterPlugin(slashMenuPluginKey)
    }
  }, [canUpload, editor])

  if (!editor.isEditable) {
    return null
  }

  // 表格命令特殊处理：删除已输入的 "/" 范围后在光标处插入所选尺寸的表格。
  function applyTable(rows: number, cols: number) {
    const range = suggestionRef.current?.range
    if (!range) return
    blockEditor.tiptap.chain().focus().deleteRange(range).run()
    insertTableBlock(blockEditor, rows, cols)
    exitSuggestion(editor.view, slashMenuPluginKey)
  }

  const tableVirtualElement = useMemo<VirtualElement | null>(
    () =>
      tableAnchorRect ? { getBoundingClientRect: () => tableAnchorRect } : null,
    [tableAnchorRect]
  )
  const { refs: tableRefs, floatingStyles: tableFloatingStyles } =
    useFloating<VirtualElement>({
      open: Boolean(tableAnchorRect),
      placement: "right-start",
      whileElementsMounted: autoUpdate,
      middleware: [
        offset(20),
        flip({ fallbackPlacements: ["left-start", "right-end", "left-end"] }),
        shift({ padding: 8 }),
      ],
    })

  useEffect(() => {
    tableRefs.setReference(tableVirtualElement)
  }, [tableRefs.setReference, tableVirtualElement])

  const slashVirtualElement = useMemo<VirtualElement | null>(
    () => (anchorRect ? { getBoundingClientRect: () => anchorRect } : null),
    [anchorRect]
  )
  const { refs: slashRefs, floatingStyles: slashFloatingStyles } =
    useFloating<VirtualElement>({
      open,
      placement: "bottom-start",
      whileElementsMounted: autoUpdate,
      middleware: [
        offset(8),
        flip({ fallbackPlacements: ["top-start", "bottom-end", "top-end"] }),
        shift({ padding: 8 }),
      ],
    })

  useEffect(() => {
    slashRefs.setReference(slashVirtualElement)
  }, [slashRefs.setReference, slashVirtualElement])

  function openTableSubmenu(element: HTMLElement) {
    if (tableCloseTimer.current) clearTimeout(tableCloseTimer.current)
    setTableAnchorRect(element.getBoundingClientRect())
  }

  function scheduleTableSubmenuClose() {
    if (tableCloseTimer.current) clearTimeout(tableCloseTimer.current)
    tableCloseTimer.current = setTimeout(() => setTableAnchorRect(null), 120)
  }

  useEffect(() => {
    if (!open || selectedId !== "table") {
      setTableAnchorRect(null)
      return
    }
    const tableItem = document.querySelector<HTMLElement>(
      '[data-slash-command="table"]'
    )
    if (tableItem) openTableSubmenu(tableItem)
  }, [open, selectedId])

  useEffect(() => {
    const container = menuScrollRef.current
    if (!container || !selectedId) return
    const item = container.querySelector<HTMLElement>(
      `[data-slash-command="${selectedId}"]`
    )
    if (!item) return

    const itemTop = item.offsetTop
    const itemBottom = itemTop + item.offsetHeight
    const visibleTop = container.scrollTop
    const visibleBottom = visibleTop + container.clientHeight
    if (itemTop < visibleTop) {
      container.scrollTop = itemTop
    } else if (itemBottom > visibleBottom) {
      container.scrollTop = itemBottom - container.clientHeight
    }
  }, [open, selectedId, items])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <>
      <div
        ref={slashRefs.setFloating}
        style={slashFloatingStyles}
        className="z-[10050] w-72 rounded-lg border border-[#E8E4DC] bg-white p-1 text-[#242321] shadow-[0_8px_24px_rgba(36,35,33,0.12)]"
        data-testid="slash-menu"
        role="listbox"
      >
        <div
          ref={menuScrollRef}
          className="max-h-72 overflow-y-auto overscroll-contain bg-white"
          onWheel={(event) => {
            // Keep slash-menu scrolling from bubbling into the editor surface.
            event.stopPropagation()
          }}
        >
          <div className="px-2 py-1.5 text-xs text-[#5C574E]">
            {query ? `/${query}` : "插入块"}
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={selectedId === item.id}
              data-slash-command={item.id}
              className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                hoveredId === item.id || selectedId === item.id
                  ? "text-[#24866B] data-[selected]:!bg-[#E6F3EC]"
                  : "bg-transparent text-[#242321]"
              }`}
              style={
                hoveredId === item.id || selectedId === item.id
                  ? {
                      backgroundColor: "#D9F0E3",
                      boxShadow:
                        "inset 0 0 0 1px #A8D3BC, 0 2px 6px rgba(36, 35, 33, 0.1)",
                    }
                  : undefined
              }
              onMouseEnter={(event) => {
                setHoveredId(item.id)
                setSelectedId(item.id)
                keyboardNavigationRef.current = false
                if (item.id === "table") {
                  tablePinnedRef.current = false
                  openTableSubmenu(event.currentTarget)
                } else {
                  tablePinnedRef.current = false
                  setTableAnchorRect(null)
                }
              }}
              onPointerMove={(event) => {
                if (item.id === "table") openTableSubmenu(event.currentTarget)
              }}
              onMouseLeave={() => {
                setHoveredId("")
                if (item.id === "table") scheduleTableSubmenuClose()
              }}
              onClick={() => {
                if (item.id !== "table") suggestionRef.current?.command(item)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tableAnchorRect ? (
        <div
          ref={tableRefs.setFloating}
          style={tableFloatingStyles}
          className="z-[10060] rounded-lg border border-[#E8E4DC] bg-white text-[#242321] shadow-[0_8px_24px_rgba(36,35,33,0.12)]"
          onMouseEnter={() => {
            if (tableCloseTimer.current) clearTimeout(tableCloseTimer.current)
          }}
          onMouseLeave={scheduleTableSubmenuClose}
          data-testid="table-slash-submenu"
        >
          <TableGridPicker onSelect={applyTable} />
        </div>
      ) : null}
    </>,
    document.body
  )
  /* Legacy nested menu implementation removed in favor of body-level portals. */
  /* return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          exitSuggestion(editor.view, slashMenuPluginKey)
        }
        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            aria-hidden
            tabIndex={-1}
          />
        }
      />
      <PopoverContent
        align="start"
        side="bottom"
        className="relative w-72 bg-white p-0 text-[#242321]"
        data-testid="slash-menu"
        initialFocus={false}
        finalFocus={false}
      >
        <Command
          shouldFilter={false}
          value={selectedId}
          className="bg-white text-[#242321]"
          onValueChange={setSelectedId}
        >
          <CommandList>
            <CommandEmpty>没有匹配的命令</CommandEmpty>
            <CommandGroup heading={query ? `/${query}` : "插入块"}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={item.keywords}
                  className="hover:!bg-[#F3F2EF] hover:!text-[#242321] data-[selected]:!bg-[#E6F3EC] data-[selected]:!text-[#24866B]"
                  onMouseEnter={(event) => {
                    if (item.id === "table") {
                      const label = event.currentTarget.querySelector(
                        "[data-slash-label]"
                      )
                      openTableSubmenu(
                        (label as HTMLElement | null) ?? event.currentTarget
                      )
                    } else {
                      setTableAnchorRect(null)
                    }
                  }}
                  onPointerMove={(event) => {
                    if (item.id === "table") {
                      const label = event.currentTarget.querySelector(
                        "[data-slash-label]"
                      )
                      openTableSubmenu(
                        (label as HTMLElement | null) ?? event.currentTarget
                      )
                    }
                  }}
                  onMouseLeave={() => {
                    if (item.id === "table") {
                      if (keyboardNavigationRef.current) {
                        setTableAnchorRect(null)
                      } else {
                        scheduleTableSubmenuClose()
                      }
                    }
                  }}
                  onSelect={() => {
                    if (item.id === "table") {
                      // 表格通过悬浮的二级网格选择尺寸，不在一级菜单直接插入。
                      return
                    }
                    suggestionRef.current?.command(item)
                  }}
                >
                  <span data-slash-label>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {tableAnchorRect && typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed z-[9999] rounded-lg bg-white text-[#242321] shadow-md ring-1 ring-black/10"
                ref={tableRefs.setFloating}
                style={tableFloatingStyles}
                onMouseEnter={() => {
                  if (tableCloseTimer.current) {
                    clearTimeout(tableCloseTimer.current)
                  }
                }}
                onMouseLeave={scheduleTableSubmenuClose}
                data-testid="table-slash-submenu"
              >
                <TableGridPicker onSelect={applyTable} />
              </div>,
              document.body
            )
          : null}
      </PopoverContent>
    </Popover>
  ) */
}
