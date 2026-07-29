import { searchSegments } from '@/helpers/search'

export function HighlightedText({ value, search }: { value: string; search: string }) {
  return (
    <>
      {searchSegments(value, search).map((segment) =>
        segment.highlighted ? (
          <mark className="rounded-sm bg-accent px-0.5 text-accent-foreground" key={segment.key}>
            {segment.text}
          </mark>
        ) : (
          <span key={segment.key}>{segment.text}</span>
        ),
      )}
    </>
  )
}
