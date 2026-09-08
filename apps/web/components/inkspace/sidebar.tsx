import type { Icon } from "@workspace/icons"
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  EllipsisIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  SquarePenIcon,
  StarIcon,
  WaypointsIcon,
  RotateCcwIcon,
} from "@workspace/icons"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import { useState } from "react"
import { PencilIcon } from "./icon"

type SidebarDocument = {
  id: string
  title: string
  parentId?: string | null
  depth?: number
  isFavorite?: boolean
}

export function flattenDocuments(
  items: readonly SidebarDocument[]
): SidebarDocument[] {
  const byParent = new Map<string | null, SidebarDocument[]>()
  for (const item of items) {
    const key = item.parentId ?? null
    const siblings = byParent.get(key) ?? []
    siblings.push(item)
    byParent.set(key, siblings)
  }
  const result: SidebarDocument[] = []
  const visit = (parentId: string | null) => {
    for (const item of byParent.get(parentId) ?? []) {
      result.push(item)
      visit(item.id)
    }
  }
  visit(null)
  for (const item of items) if (!result.includes(item)) result.push(item)
  return result
}

function getDocumentDepth(
  item: SidebarDocument,
  byId: Map<string, SidebarDocument>,
  seen = new Set<string>()
): number {
  if (item.depth && item.depth > 1) return item.depth
  if (!item.parentId || seen.has(item.id)) return 1
  const parent = byId.get(item.parentId)
  if (!parent) return 1
  seen.add(item.id)
  return Math.min(3, getDocumentDepth(parent, byId, seen) + 1)
}

export function WorkspaceSidebar({
  onCreateDocument,
  creatingDocument = false,
  documents = [],
  collaborativeDocuments = [],
  trashedDocuments = [],
  showFavorites = false,
  showTrash = false,
  selectedDocumentId,
  onSelectDocument,
  onRenameDocument,
  onDeleteDocument,
  onCreateChildDocument,
  onOpenSquare,
  onOpenGraph,
  onOpenSearch,
  onToggleFavorites,
  onToggleTrash,
  onToggleFavorite,
  onRestoreDocument,
  onPurgeDocument,
  activeNav = "editor",
}: {
  onCreateDocument?: () => void
  onCreateChildDocument?: (id: string) => void
  creatingDocument?: boolean
  documents?: SidebarDocument[]
  collaborativeDocuments?: SidebarDocument[]
  trashedDocuments?: SidebarDocument[]
  showFavorites?: boolean
  showTrash?: boolean
  selectedDocumentId?: string
  activeNav?: "editor" | "graph" | "square"
  onSelectDocument?: (id: string) => void
  onRenameDocument?: (id: string, title: string) => Promise<void>
  onDeleteDocument?: (id: string) => Promise<void>
  onOpenSquare?: () => void
  onOpenGraph?: () => void
  onOpenSearch?: () => void
  onToggleFavorites?: () => void
  onToggleTrash?: () => void
  onToggleFavorite?: (id: string, isFavorite: boolean) => void
  onRestoreDocument?: (id: string) => void
  onPurgeDocument?: (id: string) => void
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const select = (key: string, action?: () => void) => {
    setSelectedKey(key)
    action?.()
  }
  const selectDocument = (id: string) => {
    setSelectedKey(`doc:${id}`)
    onSelectDocument?.(id)
  }
  return (
    <aside
      className="hidden h-full shrink-0 flex-col gap-[18px] overflow-hidden border-r bg-white px-3 py-4 lg:flex"
      style={{ width: 280 }}
    >
      <div className="flex shrink-0 flex-col gap-[10px] rounded-xl bg-[#FCFCFB] px-2 pt-2 pb-3">
        <div className="flex h-[60px] items-center gap-[10px] px-1 py-2">
          <Avatar className="size-[34px] rounded-[10px] bg-[#242321]">
            <AvatarFallback className="rounded-[10px] bg-[#242321] text-white">
              L
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">栖木工作室</span>
            <span className="text-[10px] font-semibold tracking-[0.4px] text-[#78746C]">
              PRO · 6 位成员
            </span>
          </div>
          <PencilIcon icon={ChevronsUpDownIcon} />
        </div>
        <div className="flex flex-col gap-[3px]">
          <SideAction
            itemKey="search"
            selectedKey={selectedKey}
            onSelect={select}
            icon={SearchIcon}
            label="搜索"
            shortcut="⌘ K"
            onClick={onOpenSearch}
          />
          <SideAction
            itemKey="new-document"
            selectedKey={selectedKey}
            onSelect={select}
            icon={PlusIcon}
            label={creatingDocument ? "新建中" : "新建文档"}
            shortcut="N"
            onClick={onCreateDocument}
            disabled={creatingDocument}
          />
          <SideAction
            itemKey="square"
            selectedKey={activeNav === "square" ? "square" : selectedKey}
            onSelect={select}
            icon={SquarePenIcon}
            label="写作广场"
            onClick={onOpenSquare}
          />
          <SideAction
            itemKey="graph"
            selectedKey={activeNav === "graph" ? "graph" : selectedKey}
            onSelect={select}
            icon={WaypointsIcon}
            label="文档图谱"
            onClick={onOpenGraph}
          />
          <SideAction
            itemKey="trash"
            selectedKey={showTrash ? "trash" : selectedKey}
            onSelect={select}
            icon={RotateCcwIcon}
            label={showTrash ? "全部文档" : "回收站"}
            onClick={onToggleTrash}
          />
          <SideAction
            itemKey="favorites"
            selectedKey={showFavorites ? "favorites" : selectedKey}
            onSelect={select}
            icon={StarIcon}
            label={showFavorites ? "全部文档" : "收藏"}
            shortcut="3"
            onClick={onToggleFavorites}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-white">
        {showTrash ? (
          <TrashSection
            items={trashedDocuments}
            onRestore={onRestoreDocument}
            onPurge={onPurgeDocument}
          />
        ) : (
          <>
            {!showFavorites && collaborativeDocuments.length > 0 ? (
              <SideSection
                title="协作文档"
                count={String(collaborativeDocuments.length)}
                items={collaborativeDocuments}
                selectedDocumentId={selectedDocumentId}
                onSelect={selectDocument}
                onToggleFavorite={onToggleFavorite}
              />
            ) : null}
            <SideSection
              title={showFavorites ? "收藏" : "个人文档"}
              count={String(documents.length)}
              items={documents}
              selectedDocumentId={selectedDocumentId}
              onSelect={selectDocument}
              onRename={onRenameDocument}
              onDelete={onDeleteDocument}
              onCreateChild={onCreateChildDocument}
              onToggleFavorite={onToggleFavorite}
            />
          </>
        )}
      </div>
      <Separator />
      <div className="flex flex-col gap-[10px] px-1 pt-[10px]">
        <div className="flex items-center gap-2 text-[11px] text-[#78746C]">
          <span className="size-[7px] rounded-full bg-[#22C55E]" />
          所有更改已同步
          <span className="flex-1" />
          <PencilIcon icon={InfoIcon} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-semibold text-[#78746C]">
            <span>知识容量</span>
            <span className="text-[#24866B]">62%</span>
          </div>
          <div className="h-1 rounded bg-[#DFE1DC]">
            <div className="h-1 w-[62%] rounded bg-[#24866B]" />
          </div>
        </div>
      </div>
    </aside>
  )
}

function SideAction({
  itemKey,
  selectedKey,
  onSelect,
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  className,
}: {
  itemKey: string
  selectedKey: string | null
  onSelect: (key: string, action?: () => void) => void
  icon: Icon
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const selected = selectedKey === itemKey
  return (
    <Button
      variant="ghost"
      aria-current={selected ? "page" : undefined}
      onClick={() => onSelect(itemKey, onClick)}
      disabled={disabled}
      className={`h-[34px] !justify-start gap-2.5 rounded-[7px] px-[9px] ${className ?? ""} ${selected ? "!bg-[#E6F3EC] !text-[#24866B] hover:!bg-[#DDEFE5]" : "!text-[#242321] hover:!bg-[#F3F2EF]"}`}
    >
      <PencilIcon icon={icon} color={selected ? "#24866B" : "#78746C"} />
      <span className="text-[13px] font-medium">{label}</span>
      <span className="flex-1" />
      {shortcut && (
        <span className="text-[10px] text-[#78746C]">{shortcut}</span>
      )}
    </Button>
  )
}

function SideSection({
  title,
  count,
  items,
  selectedDocumentId,
  onSelect,
  onRename,
  onDelete,
  onCreateChild,
  onToggleFavorite,
}: {
  title: string
  count: string
  items: readonly SidebarDocument[]
  selectedDocumentId?: string
  onSelect: (id: string) => void
  onRename?: (id: string, title: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreateChild?: (id: string) => void
  onToggleFavorite?: (id: string, isFavorite: boolean) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<SidebarDocument | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const orderedItems = flattenDocuments(items)
  const parentById = new Map(
    items.map((item) => [item.id, item.parentId ?? null])
  )
  const itemById = new Map(items.map((item) => [item.id, item]))
  const hasChildren = new Set(
    items.map((item) => item.parentId).filter(Boolean)
  )
  const visibleItems = orderedItems.filter((item) => {
    let parentId = parentById.get(item.id) ?? null
    while (parentId) {
      if (collapsedIds.has(parentId)) return false
      parentId = parentById.get(parentId) ?? null
    }
    return true
  })
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-6 items-center gap-1.5 px-[7px] text-[11px] font-semibold tracking-[0.3px] text-[#78746C]">
        <PencilIcon icon={ChevronDownIcon} size={12} />
        <span>{title}</span>
        <span className="flex-1" />
        <span className="font-normal">{count}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {visibleItems.length === 0 ? (
          <p className="px-2 text-[12px] text-[#78746C]">
            {title === "收藏" ? "暂无收藏的文档" : "暂无文档"}
          </p>
        ) : null}
        {visibleItems.map(({ id, title: label }) => {
          const depth = getDocumentDepth(itemById.get(id)!, itemById)
          const active = selectedDocumentId === id
          const favorited = itemById.get(id)?.isFavorite ?? false
          const Component = hasChildren.has(id)
            ? collapsedIds.has(id)
              ? FolderIcon
              : FolderOpenIcon
            : FileTextIcon
          return (
            <div
              key={id}
              className="group relative flex items-center"
              style={{ marginLeft: `${(depth - 1) * 16}px` }}
            >
              <Button
                variant="ghost"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={`h-8 w-full !justify-start gap-[9px] rounded-[7px] px-2 ${onToggleFavorite ? "pr-14" : "pr-8"} ${active ? "!bg-[#E6F3EC] !text-[#24866B]" : "!text-[#242321] hover:!bg-[#F3F2EF]"}`}
              >
                {hasChildren.has(id) && (
                  <span
                    role="button"
                    aria-label={
                      collapsedIds.has(id) ? "展开子文档" : "折叠子文档"
                    }
                    className="mr-[-3px] -ml-1 flex size-4 shrink-0 items-center justify-center"
                    onClick={(event) => {
                      event.stopPropagation()
                      setCollapsedIds((current) => {
                        const next = new Set(current)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })
                    }}
                  >
                    <PencilIcon
                      icon={ChevronDownIcon}
                      size={12}
                      className={
                        collapsedIds.has(id)
                          ? "-rotate-90 transition-transform"
                          : "transition-transform"
                      }
                    />
                  </span>
                )}
                {!hasChildren.has(id) && (
                  <span
                    aria-hidden="true"
                    className="mr-[-3px] -ml-1 block size-4 shrink-0"
                  />
                )}
                {editingId === id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draft.trim()) {
                        void onRename?.(id, draft.trim())
                        setEditingId(null)
                      }
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="w-full bg-transparent outline-none"
                  />
                ) : (
                  <>
                    <PencilIcon
                      icon={Component}
                      color={active ? "#24866B" : "#78746C"}
                    />
                    <span
                      className={`truncate text-[13px] ${active ? "font-semibold !text-[#24866B]" : "font-normal !text-[#242321]"}`}
                    >
                      {label}
                    </span>
                  </>
                )}
              </Button>
              {onToggleFavorite ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={favorited ? "取消收藏" : "收藏"}
                  className={`absolute right-7 ${favorited ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleFavorite(id, !favorited)
                  }}
                >
                  <PencilIcon
                    icon={StarIcon}
                    size={14}
                    color={favorited ? "#F59E0B" : "#78746C"}
                  />
                </Button>
              ) : null}
              {(onRename || onDelete || onCreateChild || onToggleFavorite) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="absolute right-1 opacity-0 group-hover:opacity-100"
                      />
                    }
                  >
                    <PencilIcon icon={EllipsisIcon} size={16} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onToggleFavorite ? (
                      <DropdownMenuItem
                        onClick={() => onToggleFavorite(id, !favorited)}
                      >
                        {favorited ? "取消收藏" : "收藏"}
                      </DropdownMenuItem>
                    ) : null}
                    {(!items.find((item) => item.id === id)?.depth ||
                      (items.find((item) => item.id === id)?.depth ?? 1) <
                        3) && (
                      <DropdownMenuItem onClick={() => onCreateChild?.(id)}>
                        新增子文档
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingId(id)
                        setDraft(label)
                      }}
                    >
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget({ id, title: label })}
                    >
                      移入回收站
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        })}
      </div>
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移入回收站？</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}
              ”将移入回收站，之后可从回收站恢复或永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                if (deleteTarget) void onDelete?.(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              移入回收站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TrashSection({
  items,
  onRestore,
  onPurge,
}: {
  items: readonly SidebarDocument[]
  onRestore?: (id: string) => void
  onPurge?: (id: string) => void
}) {
  const [purgeTarget, setPurgeTarget] = useState<SidebarDocument | null>(null)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-6 items-center gap-1.5 px-[7px] text-[11px] font-semibold tracking-[0.3px] text-[#78746C]">
        <span>回收站</span>
        <span className="flex-1" />
        <span className="font-normal">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-2 text-[12px] text-[#78746C]">暂无已删除的文档</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <div key={item.id} className="group relative flex items-center">
              <Button
                variant="ghost"
                className="h-8 w-full !justify-start gap-[9px] rounded-[7px] px-2 pr-8 !text-[#78746C]"
              >
                <PencilIcon icon={FileTextIcon} color="#78746C" />
                <span className="truncate text-[13px]">{item.title}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="absolute right-1 opacity-0 group-hover:opacity-100"
                    />
                  }
                >
                  <PencilIcon icon={EllipsisIcon} size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRestore?.(item.id)}>
                    恢复
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setPurgeTarget(item)}
                  >
                    永久删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPurgeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除？</AlertDialogTitle>
            <AlertDialogDescription>
              “{purgeTarget?.title}”将被永久删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                if (purgeTarget) onPurge?.(purgeTarget.id)
                setPurgeTarget(null)
              }}
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
