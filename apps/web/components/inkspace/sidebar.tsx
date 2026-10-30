import type { Icon } from "@workspace/icons"
import {
  ChevronDownIcon,
  EllipsisIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  CheckIcon,
  InfoIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Separator } from "@workspace/ui/components/separator"
import { useEffect, useState } from "react"
import { PencilIcon } from "./icon"

const SIDEBAR_WIDTH_EXPANDED = 280
const SIDEBAR_WIDTH_COLLAPSED = 56
const SIDEBAR_COLLAPSED_STORAGE_KEY = "inkspace:sidebar-collapsed:v1"

function readSidebarCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

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

type WorkspaceHeader = {
  id: string
  name: string
  memberCount: number
}

export function WorkspaceSidebar({
  workspace,
  workspaces = [],
  onSwitchWorkspace,
  onCreateWorkspace,
  onManageMembers,
  onOpenWorkspaces,
  onOpenLibraries,
  onOpenLibraryAsk,
  onCreateDocument,
  creatingDocument = false,
  documents = [],
  collaborativeDocuments = [],
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
  activeNav = "editor",
}: {
  workspace?: WorkspaceHeader
  workspaces?: WorkspaceHeader[]
  onSwitchWorkspace?: (id: string) => void
  onCreateWorkspace?: () => void
  onManageMembers?: () => void
  onOpenWorkspaces?: () => void
  onOpenLibraries?: () => void
  onOpenLibraryAsk?: () => void
  onCreateDocument?: () => void
  onCreateChildDocument?: (id: string) => void
  creatingDocument?: boolean
  documents?: SidebarDocument[]
  collaborativeDocuments?: SidebarDocument[]
  showFavorites?: boolean
  showTrash?: boolean
  selectedDocumentId?: string
  activeNav?:
    | "editor"
    | "graph"
    | "square"
    | "workspaces"
    | "libraries"
    | "library-ask"
  onSelectDocument?: (id: string) => void
  onRenameDocument?: (id: string, title: string) => Promise<void>
  onDeleteDocument?: (id: string) => Promise<void>
  onOpenSquare?: () => void
  onOpenGraph?: () => void
  onOpenSearch?: () => void
  onToggleFavorites?: () => void
  onToggleTrash?: () => void
  onToggleFavorite?: (id: string, isFavorite: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsedPreference)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [collapseTooltipOpen, setCollapseTooltipOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    } catch {
      // 隐私模式或禁用 storage 时忽略
    }
  }, [collapsed])

  // 宽度切换后关闭 tooltip 并失焦，避免 click/focus 触发的浮层卡在旧位置
  useEffect(() => {
    setCollapseTooltipOpen(false)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [collapsed])

  const toggleCollapsed = () => {
    setCollapseTooltipOpen(false)
    setCollapsed((current) => !current)
  }

  const select = (key: string, action?: () => void) => {
    setSelectedKey(key)
    action?.()
  }
  const selectDocument = (id: string) => {
    setSelectedKey(`doc:${id}`)
    onSelectDocument?.(id)
  }
  const browseActive =
    activeNav === "square" ||
    activeNav === "graph" ||
    activeNav === "workspaces" ||
    activeNav === "libraries" ||
    activeNav === "library-ask" ||
    showFavorites ||
    showTrash
  return (
    <TooltipProvider delay={0}>
      <aside
        aria-expanded={!collapsed}
        className="hidden h-full shrink-0 flex-col overflow-hidden border-r bg-white transition-[width] duration-200 ease-out lg:flex"
        style={{
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        }}
      >
        <div
          className={`flex shrink-0 flex-col gap-[10px] rounded-xl bg-[#FCFCFB] px-2 pt-2 ${collapsed ? "pb-2" : "pb-3"}`}
        >
          <div
            className={`flex shrink-0 items-center ${collapsed ? "justify-center px-0 py-2" : "h-[60px] gap-[10px] px-1 py-2"}`}
          >
            <WorkspaceAvatarMenu
              workspace={workspace}
              workspaces={workspaces}
              collapsed={collapsed}
              onSwitchWorkspace={onSwitchWorkspace}
              onOpenWorkspaces={onOpenWorkspaces}
              onManageMembers={onManageMembers}
              onCreateWorkspace={onCreateWorkspace}
            />
            {collapsed ? null : (
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {workspace?.name ?? "知识库"}
                </span>
                <button
                  type="button"
                  className="text-left text-[10px] font-semibold tracking-[0.4px] text-[#78746C] hover:text-[#242321]"
                  onClick={() => onManageMembers?.()}
                >
                  {workspace?.memberCount ?? 0} 位成员
                </button>
              </div>
            )}
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
              compact={collapsed}
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
              compact={collapsed}
            />
            {/* 次要入口收进「浏览」，避免上半区按钮堆叠 */}
            <SideBrowseMenu
              active={browseActive}
              activeNav={activeNav}
              showFavorites={showFavorites}
              showTrash={showTrash}
              compact={collapsed}
              onOpenWorkspaces={onOpenWorkspaces}
              onOpenLibraries={onOpenLibraries}
              onOpenLibraryAsk={onOpenLibraryAsk}
              onOpenSquare={onOpenSquare}
              onOpenGraph={onOpenGraph}
              onToggleFavorites={onToggleFavorites}
              onToggleTrash={onToggleTrash}
            />
          </div>
        </div>
        {collapsed ? null : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-white px-3">
            {collaborativeDocuments.length > 0 ? (
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
              title="个人文档"
              count={String(documents.length)}
              items={documents}
              selectedDocumentId={selectedDocumentId}
              onSelect={selectDocument}
              onRename={onRenameDocument}
              onDelete={onDeleteDocument}
              onCreateChild={onCreateChildDocument}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        )}
        {collapsed ? <div className="min-h-0 flex-1" /> : null}
        <Separator />
        <div
          className={`flex shrink-0 flex-col gap-[10px] px-2 pt-[10px] pb-4 ${collapsed ? "items-center" : "px-3"}`}
        >
          {collapsed ? null : (
            <>
              <div className="flex items-center gap-2 px-1 text-[11px] text-[#78746C]">
                <span className="size-[7px] rounded-full bg-[#22C55E]" />
                所有更改已同步
                <span className="flex-1" />
                <PencilIcon icon={InfoIcon} />
              </div>
              <div className="flex flex-col gap-1.5 px-1">
                <div className="flex justify-between text-[10px] font-semibold text-[#78746C]">
                  <span>知识容量</span>
                  <span className="text-[#24866B]">62%</span>
                </div>
                <div className="h-1 rounded bg-[#DFE1DC]">
                  <div className="h-1 w-[62%] rounded bg-[#24866B]" />
                </div>
              </div>
            </>
          )}
          {collapsed ? (
            <Tooltip
              open={collapseTooltipOpen}
              onOpenChange={setCollapseTooltipOpen}
            >
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="展开侧边栏"
                    onClick={toggleCollapsed}
                    className="size-9 rounded-[7px] !text-[#78746C] hover:!bg-[#F3F2EF]"
                  />
                }
              >
                <PencilIcon icon={PanelLeftIcon} color="#78746C" />
              </TooltipTrigger>
              <TooltipContent side="right">展开侧边栏</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-label="收起侧边栏"
              onClick={toggleCollapsed}
              className="h-[34px] w-full !justify-start gap-2.5 rounded-[7px] px-[9px] !text-[#78746C] hover:!bg-[#F3F2EF]"
            >
              <PencilIcon icon={PanelLeftCloseIcon} color="#78746C" />
              <span className="text-[13px] font-medium">收起侧边栏</span>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

/** 点击知识库头像展开切换/管理菜单。 */
function WorkspaceAvatarMenu({
  workspace,
  workspaces,
  collapsed,
  onSwitchWorkspace,
  onOpenWorkspaces,
  onManageMembers,
  onCreateWorkspace,
}: {
  workspace?: WorkspaceHeader
  workspaces: WorkspaceHeader[]
  collapsed: boolean
  onSwitchWorkspace?: (id: string) => void
  onOpenWorkspaces?: () => void
  onManageMembers?: () => void
  onCreateWorkspace?: () => void
}) {
  const initial = (workspace?.name ?? "库").slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="知识库菜单"
            className="size-[34px] shrink-0 rounded-[10px] p-0 hover:bg-[#F3F2EF]"
          />
        }
      >
        <Avatar className="size-[34px] rounded-[10px] bg-[#242321]">
          <AvatarFallback className="rounded-[10px] bg-[#242321] text-white">
            {initial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={collapsed ? "right" : "bottom"}
        className="w-56"
      >
        {workspaces.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => onSwitchWorkspace?.(item.id)}
          >
            <span className="truncate">{item.name}</span>
            <span className="ml-auto text-[10px] text-[#78746C]">
              {item.memberCount}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onOpenWorkspaces?.()}>
          全部知识库
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onManageMembers?.()}>
          成员管理
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreateWorkspace?.()}>
          新建知识库
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SideBrowseMenu({
  active,
  activeNav,
  showFavorites,
  showTrash,
  compact,
  onOpenWorkspaces,
  onOpenLibraries,
  onOpenLibraryAsk,
  onOpenSquare,
  onOpenGraph,
  onToggleFavorites,
  onToggleTrash,
}: {
  active: boolean
  activeNav:
    | "editor"
    | "graph"
    | "square"
    | "workspaces"
    | "libraries"
    | "library-ask"
  showFavorites: boolean
  showTrash: boolean
  compact: boolean
  onOpenWorkspaces?: () => void
  onOpenLibraries?: () => void
  onOpenLibraryAsk?: () => void
  onOpenSquare?: () => void
  onOpenGraph?: () => void
  onToggleFavorites?: () => void
  onToggleTrash?: () => void
}) {
  const trigger = (
    <Button
      variant="ghost"
      aria-label={compact ? "浏览" : undefined}
      aria-haspopup="menu"
      className={`${compact ? "size-9 !justify-center px-0" : "h-[34px] !justify-start gap-2.5 px-[9px]"} rounded-[7px] ${active ? "!bg-[#E6F3EC] !text-[#24866B] hover:!bg-[#DDEFE5]" : "!text-[#242321] hover:!bg-[#F3F2EF]"}`}
    >
      <PencilIcon
        icon={LayoutDashboardIcon}
        color={active ? "#24866B" : "#78746C"}
      />
      {compact ? null : (
        <>
          <span className="text-[13px] font-medium">浏览</span>
          <span className="flex-1" />
        </>
      )}
    </Button>
  )

  const menuContent = (
    <DropdownMenuContent align="start" className="w-52">
      <BrowseMenuItem
        label="全部知识库"
        active={activeNav === "workspaces"}
        onClick={onOpenWorkspaces}
      />
      {/* 产品名是资料库；不要改动或挪走「全部知识库」。 */}
      <BrowseMenuItem
        label="资料库"
        active={activeNav === "libraries"}
        onClick={onOpenLibraries}
      />
      <BrowseMenuItem
        label="资料库问答"
        active={activeNav === "library-ask"}
        onClick={onOpenLibraryAsk}
      />
      <BrowseMenuItem
        label="写作广场"
        active={activeNav === "square"}
        onClick={onOpenSquare}
      />
      <BrowseMenuItem
        label="文档图谱"
        active={activeNav === "graph"}
        onClick={onOpenGraph}
      />
      <DropdownMenuSeparator />
      <BrowseMenuItem
        label="收藏"
        active={showFavorites}
        onClick={onToggleFavorites}
      />
      <BrowseMenuItem
        label="回收站"
        active={showTrash}
        onClick={onToggleTrash}
      />
    </DropdownMenuContent>
  )

  if (!compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        {menuContent}
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger render={<DropdownMenuTrigger render={trigger} />} />
        <TooltipContent side="right">浏览</TooltipContent>
      </Tooltip>
      {menuContent}
    </DropdownMenu>
  )
}

function BrowseMenuItem({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="gap-2">
      <span className={active ? "font-semibold text-[#24866B]" : undefined}>
        {label}
      </span>
      {active ? (
        <PencilIcon
          icon={CheckIcon}
          size={14}
          className="ml-auto text-[#24866B]"
        />
      ) : (
        <span className="ml-auto size-3.5" aria-hidden="true" />
      )}
    </DropdownMenuItem>
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
  compact = false,
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
  /** 折叠态仅显示图标，并通过 Tooltip 展示文案 */
  compact?: boolean
}) {
  const selected = selectedKey === itemKey
  const button = (
    <Button
      variant="ghost"
      aria-current={selected ? "page" : undefined}
      aria-label={compact ? label : undefined}
      onClick={() => onSelect(itemKey, onClick)}
      disabled={disabled}
      className={`${compact ? "size-9 !justify-center px-0" : "h-[34px] !justify-start gap-2.5 px-[9px]"} rounded-[7px] ${className ?? ""} ${selected ? "!bg-[#E6F3EC] !text-[#24866B] hover:!bg-[#DDEFE5]" : "!text-[#242321] hover:!bg-[#F3F2EF]"}`}
    >
      <PencilIcon icon={icon} color={selected ? "#24866B" : "#78746C"} />
      {compact ? null : (
        <>
          <span className="text-[13px] font-medium">{label}</span>
          <span className="flex-1" />
          {shortcut ? (
            <span className="text-[10px] text-[#78746C]">{shortcut}</span>
          ) : null}
        </>
      )}
    </Button>
  )

  if (!compact) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
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
          <p className="px-2 text-[12px] text-[#78746C]">暂无文档</p>
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
