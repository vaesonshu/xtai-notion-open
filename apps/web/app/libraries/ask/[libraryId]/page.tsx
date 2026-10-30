"use client"

import { useParams } from "next/navigation"
import { useAuth } from "../../../../components/auth-provider"
import { LibraryAskPage } from "../../../../components/libraries/library-ask-page"

export default function LibraryAskRoute() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const { user } = useAuth()
  if (!libraryId || !user) return null
  return <LibraryAskPage userId={user.id} libraryId={libraryId} />
}
