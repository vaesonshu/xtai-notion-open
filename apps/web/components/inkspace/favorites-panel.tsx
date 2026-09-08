"use client"

import { FileTextIcon, StarIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { PencilIcon } from "./icon"

type FavoriteDocument = {
  id: string
  title: string
}

/** 收藏视图：独立于侧边栏个人文档，在主内容区展示收藏列表 */
export function FavoritesPanel({
  documents,
  onSelectDocument,
}: {
  documents: readonly FavoriteDocument[]
  onSelectDocument: (id: string) => void
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="favorites-panel"
    >
      <header className="flex h-[68px] shrink-0 items-center gap-2 border-b border-[#E8E6E1] px-6">
        <PencilIcon icon={StarIcon} size={18} color="#F59E0B" />
        <h1 className="text-[15px] font-semibold text-[#242321]">收藏</h1>
        <span className="text-[13px] text-[#78746C]">{documents.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8">
        {documents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <PencilIcon icon={StarIcon} size={32} color="#D4D1CB" />
            <p className="text-sm font-medium text-[#242321]">暂无收藏</p>
            <p className="max-w-sm text-sm text-[#78746C]">
              在左侧个人文档中悬停文档，点击星标即可加入收藏。
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex w-full max-w-[720px] flex-col gap-1">
            {documents.map((document) => (
              <li key={document.id}>
                <Button
                  variant="ghost"
                  onClick={() => onSelectDocument(document.id)}
                  className="h-10 w-full !justify-start gap-2.5 rounded-lg px-3 !text-[#242321] hover:!bg-[#F3F2EF]"
                >
                  <PencilIcon icon={FileTextIcon} color="#78746C" />
                  <span className="truncate text-[14px]">{document.title}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
