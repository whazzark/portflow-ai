export default function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string }

  return candidate.code === '23505' || candidate.code === 'SQLITE_CONSTRAINT_UNIQUE'
}
