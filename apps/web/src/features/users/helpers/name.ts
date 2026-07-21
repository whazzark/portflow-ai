type UserName = {
  firstName: string
  lastName: string
}

function getNameParts({ firstName, lastName }: UserName) {
  return [firstName, lastName].map((name) => name.trim()).filter(Boolean)
}

export function formatFullName(person: UserName) {
  return getNameParts(person).join(' ')
}

export function getInitials(person: UserName) {
  return getNameParts(person)
    .map((name) => Array.from(name)[0])
    .join('')
    .toUpperCase()
}
