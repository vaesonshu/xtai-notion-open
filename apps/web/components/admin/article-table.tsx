import { EllipsisIcon } from "@workspace/icons"

import type { Article } from "./article-management-page"

export function ArticleTable({ articles }: { articles: readonly Article[] }) {
  if (articles.length === 0) {
    return (
      <div
        className="flex h-52 items-center justify-center text-[11px] text-[#89958e]"
        role="status"
      >
        未找到匹配的文章
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[10px] text-[#647068]">
        <thead className="border-b border-[#e9eeeb] text-[9px] text-[#96a099]">
          <tr>
            <th className="px-3 py-2 font-medium">文章标题</th>
            <th className="px-3 py-2 font-medium">分类</th>
            <th className="px-3 py-2 font-medium">作者</th>
            <th className="px-3 py-2 font-medium">状态</th>
            <th className="px-3 py-2 font-medium">发布时间</th>
            <th className="px-3 py-2 text-right font-medium">阅读量</th>
            <th className="w-12 px-3 py-2" aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr
              key={article.id}
              className="border-b border-[#f0f2f0] last:border-0"
            >
              <td className="px-3 py-2.5 font-medium text-[#415047]">
                {article.title}
              </td>
              <td className="px-3 py-2.5">{article.category}</td>
              <td className="px-3 py-2.5">{article.author}</td>
              <td className="px-3 py-2.5">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                    article.status === "已发布"
                      ? "bg-[#e8f5ed] text-[#318764]"
                      : "bg-[#f5f1e7] text-[#9b7a36]"
                  }`}
                >
                  {article.status}
                </span>
              </td>
              <td className="px-3 py-2.5">{article.publishedAt}</td>
              <td className="px-3 py-2.5 text-right">{article.views}</td>
              <td className="px-3 py-2.5 text-right">
                <button
                  aria-label={`操作：${article.title}`}
                  className="text-[#8b9690] hover:text-[#237c62]"
                >
                  <EllipsisIcon className="size-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
