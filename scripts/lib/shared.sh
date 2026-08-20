#!/usr/bin/env sh
set -eu

PACKAGE_MANAGER="bun"

repo_root() {
  git rev-parse --show-toplevel
}

run_pm() {
  "$PACKAGE_MANAGER" "$@"
}
