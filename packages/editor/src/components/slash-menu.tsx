"use client"

import { useEffect, useRef, useState } from "react"
import type { Editor, Range } from "@tiptap/core"
import { PluginKey } from "@tiptap/pm/state"
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  executeSlashCommand,
  filterSlashCommands,
  type SlashCommand,
} from "../core/slash-commands"
import { useEditorInstance } from "../react/use-editor-instance"

const slashMenuPluginKey = new PluginKey("slashMenu")

type SlashSuggestionState = {
  query: string
  items: SlashCommand[]
  range: Range
  command: (item: SlashCommand) => void
}

function applySlashCommand(editor: Editor, range: Range, item: SlashCommand) {
  editor.chain().focus().deleteRange(range).run()
  executeSlashCommand(editor, item.id)
}

export function SlashMenu() {
  const editor = useEditorInstance()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<SlashCommand[]>([])
  const [selectedId, setSelectedId] = useState("")
  const suggestionRef = useRef<SlashSuggestionState | null>(null)
  const selectedIdRef = useRef(selectedId)
  const itemsRef = useRef(items)

  useEffect(() => {
    selectedIdRef.current = selectedId
    itemsRef.current = items
  }, [selectedId, items])

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
      items: ({ query: nextQuery }) => filterSlashCommands(nextQuery),
      command: ({ editor: activeEditor, range, props }) => {
        applySlashCommand(activeEditor, range, props)
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
          setSelectedId(current =>
            props.items.some(item => item.id === current)
              ? current
              : (props.items[0]?.id ?? ""),
          )
          setOpen(true)
        }

        return {
          onStart: sync,
          onUpdate: sync,
          onExit: () => {
            suggestionRef.current = null
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
              exitSuggestion(editor.view, slashMenuPluginKey)
              return true
            }

            const currentItems = itemsRef.current
            if (currentItems.length === 0) {
              return false
            }

            if (event.key === "ArrowDown") {
              const index = currentItems.findIndex(
                item => item.id === selectedIdRef.current,
              )
              const next = currentItems[(index + 1) % currentItems.length]
              if (next) {
                setSelectedId(next.id)
              }
              return true
            }

            if (event.key === "ArrowUp") {
              const index = currentItems.findIndex(
                item => item.id === selectedIdRef.current,
              )
              const next =
                currentItems[
                  (index - 1 + currentItems.length) % currentItems.length
                ]
              if (next) {
                setSelectedId(next.id)
              }
              return true
            }

            if (event.key === "Enter") {
              const selected =
                currentItems.find(item => item.id === selectedIdRef.current) ??
                currentItems[0]
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

    // Prepend so Arrow/Enter/Escape are handled before default keymap actions.
    editor.registerPlugin(plugin, (nextPlugin, plugins) => [nextPlugin, ...plugins])
    return () => {
      editor.unregisterPlugin(slashMenuPluginKey)
    }
  }, [editor])

  if (!editor.isEditable) {
    return null
  }

  return (
    <Popover
      open={open}
      onOpenChange={nextOpen => {
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
        className="w-72 p-0"
        data-testid="slash-menu"
      >
        <Command
          shouldFilter={false}
          value={selectedId}
          onValueChange={setSelectedId}
        >
          <CommandList>
            <CommandEmpty>没有匹配的命令</CommandEmpty>
            <CommandGroup heading={query ? `/${query}` : "插入块"}>
              {items.map(item => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={item.keywords}
                  onSelect={() => {
                    suggestionRef.current?.command(item)
                  }}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
