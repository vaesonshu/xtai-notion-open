"use client"

import { useAuth } from "../../../components/auth-provider"
import { LibraryAskPage } from "../../../components/libraries/library-ask-page"

export default function LibrariesAskHubRoute() {
  const { user } = useAuth()
  if (!user) return null
  return <LibraryAskPage userId={user.id} />
}
