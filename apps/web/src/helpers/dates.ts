export function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB') : '—'
}
