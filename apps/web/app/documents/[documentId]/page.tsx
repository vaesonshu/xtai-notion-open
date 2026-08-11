export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params

  return <div data-document-route={documentId} className="hidden" />
}
