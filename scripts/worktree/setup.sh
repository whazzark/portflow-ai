#!/usr/bin/env bash
# Makes this worktree runnable on its own: dependencies, database, ports and session cookie.
#
# Orca runs it when it creates a worktree (see orca.yaml); run it by hand in any other worktree
# with `pnpm worktree:setup`. Running it again is safe: it keeps the worktree's slot and
# database, applies pending migrations, and rewrites only the keys it owns in the `.env` files:
#
#   apps/api/.env  PORT, DB_DATABASE, WEB_ORIGIN, SESSION_COOKIE_NAME
#   apps/web/.env  WEB_PORT, VITE_API_BASE_URL
#
# Every other key starts as a copy of the main checkout's `.env` (or `.env.example`) and is left
# alone afterwards.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

port_in_use() {
  if command -v lsof >/dev/null; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

# Prints this worktree's slot, claiming the first free one on the first run. `mkdir` is atomic,
# so two worktrees created at the same time cannot claim the same slot.
claim_slot() {
  local n dir owner
  n=$(owned_slot)
  if [ -n "$n" ]; then
    echo "$n"
    return
  fi
  mkdir -p "$SLOTS_DIR"
  for n in $(seq 1 "$MAX_SLOTS"); do
    dir="$SLOTS_DIR/$n"
    if [ -d "$dir" ]; then
      owner=$(cat "$dir/worktree" 2>/dev/null || true)
      # A slot whose worktree is gone was left behind by a removal that skipped teardown.
      if [ -z "$owner" ] || [ -d "$owner" ]; then continue; fi
      rm -rf "$dir"
    fi
    if port_in_use $((WEB_BASE_PORT + n)) || port_in_use $((API_BASE_PORT + n)); then continue; fi
    mkdir "$dir" 2>/dev/null || continue
    echo "$WORKTREE" >"$dir/worktree"
    echo "$n"
    return
  done
  die "all $MAX_SLOTS worktree slots are taken; remove unused worktrees or clean up $SLOTS_DIR"
}

# Starts the app's `.env` from the main checkout's, falling back to `.env.example`.
seed_env_file() {
  local target="$WORKTREE/apps/$1/.env"
  [ ! -f "$target" ] || return 0
  if [ -f "$ROOT/apps/$1/.env" ]; then
    cp "$ROOT/apps/$1/.env" "$target"
  else
    cp "$WORKTREE/apps/$1/.env.example" "$target"
  fi
}

ensure_postgres() {
  docker_running || die "Docker is not running; start it, then run \`pnpm worktree:setup\` again."
  if postgres_running; then return; fi
  log "Starting PostgreSQL"
  if docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
    docker start "$POSTGRES_CONTAINER" >/dev/null
  else
    # From the main checkout's compose file, so the volume is the one the main checkout uses.
    docker compose -f "$ROOT/docker/docker-compose.yml" up -d postgres
  fi
  local attempt
  for attempt in $(seq 1 30); do
    docker exec "$POSTGRES_CONTAINER" pg_isready -q && return
    sleep 1
  done
  die "PostgreSQL did not become ready in $POSTGRES_CONTAINER"
}

# The database is named after the worktree directory, so a second worktree reducing to the same
# name would share it, and removing either one would drop it from under the other.
refuse_name_clash() {
  local dir other
  for dir in "$SLOTS_DIR"/*; do
    other=$(cat "$dir/worktree" 2>/dev/null || true)
    if [ -n "$other" ] && [ "$other" != "$WORKTREE" ] && [ -d "$other" ] &&
      [ "$(slug_of "$other")" = "$slug" ]; then
      die "$other already uses the name '$slug' (database $DB_NAME); rename one of the two worktrees."
    fi
  done
}

cd "$WORKTREE"
refuse_name_clash

log "Installing dependencies"
pnpm install --frozen-lockfile

slot=$(claim_slot)
web_port=$((WEB_BASE_PORT + slot))
api_port=$((API_BASE_PORT + slot))

log "Writing apps/api/.env and apps/web/.env"
api_env="$WORKTREE/apps/api/.env"
web_env="$WORKTREE/apps/web/.env"
seed_env_file api
seed_env_file web
if [ -z "$(env_get "$api_env" APP_KEY)" ]; then
  env_set "$api_env" APP_KEY "$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('base64url'))")"
fi
env_set "$api_env" PORT "$api_port"
env_set "$api_env" DB_DATABASE "$DB_NAME"
env_set "$api_env" WEB_ORIGIN "http://localhost:$web_port"
env_set "$api_env" SESSION_COOKIE_NAME "adonis-session-$slug"
env_set "$web_env" WEB_PORT "$web_port"
env_set "$web_env" VITE_API_BASE_URL "http://localhost:$api_port"

ensure_postgres
db_user=$(env_get "$api_env" DB_USER)
db_created=false
if [ -z "$(psql_admin "$db_user" "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")" ]; then
  log "Creating database $DB_NAME"
  psql_admin "$db_user" "CREATE DATABASE \"$DB_NAME\""
  db_created=true
fi

log "Running migrations"
pnpm --dir apps/api db:migrate
# The seeders are not all safe to run twice, so only a new database is seeded.
if [ "$db_created" = true ]; then
  log "Seeding $DB_NAME"
  pnpm --dir apps/api db:seed
fi

cat <<EOF

$(printf '\033[1;32m')Worktree ready$(printf '\033[0m') — start it with \`pnpm dev\`
  Web       http://localhost:$web_port
  API       http://localhost:$api_port
  Database  $DB_NAME (container $POSTGRES_CONTAINER, port $(env_get "$api_env" DB_PORT))
EOF
