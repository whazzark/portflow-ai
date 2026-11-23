type VesselCommentProps = {
  comment: string | null
}

/** What the vessel's comment says, above the overview's cards; nothing at all without one. */
export function VesselComment({ comment }: VesselCommentProps) {
  if (!comment) {
    return null
  }

  return (
    <dl className="grid gap-1 text-sm">
      <dt className="text-muted-foreground">Vessel comment</dt>
      <dd className="whitespace-pre-line">{comment}</dd>
    </dl>
  )
}
