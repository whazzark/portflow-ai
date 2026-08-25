const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Guards a `uuid` column against an identifier taken straight from the URL: Postgres raises
 * `22P02 invalid input syntax for type uuid` on a malformed one, which would surface as a 500 where
 * the route means "no such record". Repositories use it to answer "not found" instead.
 */
export default function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}
