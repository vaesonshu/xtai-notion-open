import { redirect } from "next/navigation"

export default function Page() {
  // The document workspace now lives under /documents/:documentId.
  redirect("/documents")
}
