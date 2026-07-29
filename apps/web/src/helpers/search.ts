export function normalizeSearch(value: string) {
  return normalizeSearchCharacters(value).trim()
}

function normalizeSearchCharacters(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
}

export type SearchSegment = {
  key: string
  text: string
  highlighted: boolean
}

export function searchSegments(value: string, search: string): SearchSegment[] {
  const characters = Array.from(value)
  const normalizedSearch = Array.from(normalizeSearch(search))

  if (normalizedSearch.length === 0) {
    return [{ key: 'plain', text: value, highlighted: false }]
  }

  const normalizedValue: string[] = []
  const originalIndexes: number[] = []

  characters.forEach((character, index) => {
    for (const normalizedCharacter of Array.from(normalizeSearchCharacters(character))) {
      normalizedValue.push(normalizedCharacter)
      originalIndexes.push(index)
    }
  })

  const segments: SearchSegment[] = []
  let originalCursor = 0
  let normalizedCursor = 0

  while (normalizedCursor <= normalizedValue.length - normalizedSearch.length) {
    const matchIndex = findSequence(normalizedValue, normalizedSearch, normalizedCursor)

    if (matchIndex === -1) {
      break
    }

    const matchStart = originalIndexes[matchIndex]
    const matchEnd = originalIndexes[matchIndex + normalizedSearch.length - 1] + 1

    if (matchStart > originalCursor) {
      segments.push({
        key: `text-${originalCursor}-${matchStart}`,
        text: characters.slice(originalCursor, matchStart).join(''),
        highlighted: false,
      })
    }

    segments.push({
      key: `highlight-${matchStart}-${matchEnd}`,
      text: characters.slice(matchStart, matchEnd).join(''),
      highlighted: true,
    })
    originalCursor = matchEnd
    normalizedCursor = matchIndex + normalizedSearch.length
  }

  if (segments.length === 0) {
    return [{ key: 'plain', text: value, highlighted: false }]
  }

  if (originalCursor < characters.length) {
    segments.push({
      key: `text-${originalCursor}-${characters.length}`,
      text: characters.slice(originalCursor).join(''),
      highlighted: false,
    })
  }

  return segments
}

function findSequence(value: string[], sequence: string[], fromIndex: number) {
  for (let index = fromIndex; index <= value.length - sequence.length; index += 1) {
    if (sequence.every((character, offset) => value[index + offset] === character)) {
      return index
    }
  }

  return -1
}
