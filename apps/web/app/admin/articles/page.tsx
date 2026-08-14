import { ArticleManagementPage } from "../../../components/admin/article-management-page"

export default function Page() {
  // Keep the route server-rendered while the dashboard owns its local interactions.
  return <ArticleManagementPage />
}
