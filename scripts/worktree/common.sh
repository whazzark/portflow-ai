# Shared by setup.sh and teardown.sh: where the worktree lives and what it owns.
#
# Every worktree owns a slot number n, recorded under the Git common directory so that all
# checkouts see the same registry. The slot gives the worktree its ports; its directory name
# gives it its database and session cookie. The main checkout owns none of these: it keeps
# `portflow`, port 3000 and port 3333.

POSTGRES_CONTAINER=portflow-postgres
DB_PREFIX=portflow_wt_
WEB_BASE_PORT=3000
API_BASE_PORT=3333
MAX_SLOTS=99

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WORKTREE=$(git -C "$script_dir" rev-parse --show-toplevel)
GIT_COMMON_DIR=$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir)
ROOT=$(dirname "$GIT_COMMON_DIR")
SLOTS_DIR="$GIT_COMMON_DIR/portflow-worktrees/slots"

[ "$WORKTREE" != "$ROOT" ] || die "$ROOT is the main checkout; run this from a worktree."

# Prints a worktree's directory name, reduced to what a PostgreSQL identifier and a cookie name
# accept. Long names keep a checksum of the full name so that two of them sharing a prefix stay
# distinct within PostgreSQL's 63-byte identifier limit.
slug_of() {
  local slug
  slug=$(basename "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//')
  if [ ${#slug} -gt $((63 - ${#DB_PREFIX})) ]; then
    slug="${slug:0:40}_$(printf %s "$slug" | cksum | cut -d ' ' -f 1)"
  fi
  echo "$slug"
}

slug=$(slug_of "$WORKTREE")
[ -n "$slug" ] || die "cannot derive a name from $WORKTREE"
DB_NAME="$DB_PREFIX$slug"

# Prints the value of KEY in a dotenv file, without evaluating the file.
env_get() { sed -n "s/^$2=//p" "$1" | tail -n 1; }

# Sets KEY to VALUE in a dotenv file, in place of its existing assignment or appended.
env_set() {
  local file=$1 key=$2 value=$3 tmp
  tmp=$(mktemp)
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { if (!done) print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' "$file" >"$tmp" && mv "$tmp" "$file"
}

# Prints the slot this worktree owns, or nothing.
owned_slot() {
  local dir
  for dir in "$SLOTS_DIR"/*; do
    [ -f "$dir/worktree" ] && [ "$(cat "$dir/worktree")" = "$WORKTREE" ] && basename "$dir"
  done
  return 0
}

docker_running() { docker info >/dev/null 2>&1; }

postgres_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null)" = true ]
}

# Runs SQL as the database owner against the maintenance database, through the container.
psql_admin() {
  docker exec -i "$POSTGRES_CONTAINER" \
    psql -X -q -t -A -v ON_ERROR_STOP=1 -U "$1" -d postgres -c "$2"
}
