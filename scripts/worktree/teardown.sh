#!/usr/bin/env bash
# Releases what setup.sh gave this worktree: drops its database and frees its slot.
#
# Orca runs it before it archives or removes a worktree (see orca.yaml); run it by hand with
# `pnpm worktree:teardown`. It only ever drops a database named `portflow_wt_*`, so the main
# checkout's database is out of its reach. A step it cannot complete is reported, not fatal, so
# that it never blocks the removal of a worktree.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

api_env="$WORKTREE/apps/api/.env"
db_name=$DB_NAME
db_user=postgres
if [ -f "$api_env" ]; then
  db_name=$(env_get "$api_env" DB_DATABASE)
  db_user=$(env_get "$api_env" DB_USER)
fi

if [[ ! "$db_name" =~ ^${DB_PREFIX}[a-z0-9_]+$ ]]; then
  warn "leaving database '$db_name' in place: only $DB_PREFIX* databases are dropped"
elif ! docker_running || ! postgres_running; then
  warn "$POSTGRES_CONTAINER is not running; drop $db_name later with:"
  warn "  docker exec $POSTGRES_CONTAINER dropdb -U $db_user --if-exists --force $db_name"
else
  log "Dropping database $db_name"
  psql_admin "$db_user" "DROP DATABASE IF EXISTS \"$db_name\" WITH (FORCE)" ||
    warn "could not drop $db_name"
fi

slot=$(owned_slot)
if [ -n "$slot" ]; then
  log "Freeing ports $((WEB_BASE_PORT + slot)) and $((API_BASE_PORT + slot))"
  rm -rf "${SLOTS_DIR:?}/$slot"
fi
