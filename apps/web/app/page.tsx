import { redirect } from "next/navigation"

export default function Page() {
  // 默认进入个人文档空间；公开浏览见 /square，公开知识库见 /w/:slug。
  redirect("/documents")
}
