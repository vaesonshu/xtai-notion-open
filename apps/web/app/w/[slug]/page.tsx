import { PublicWorkspacePage } from "@/components/inkspace/public-workspace-page"

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <PublicWorkspacePage workspaceKey={slug} />
}
