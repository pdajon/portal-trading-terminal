#!/bin/zsh
set -u

REPO_PATH="/Users/pierredajon/Documents/Ok Deal /portal /Portal/Portal/Portal"
REMOTE_NAME="origin"
BRANCH_NAME="main"
LOG_DIR="${HOME}/Library/Logs/Portal"
LOG_FILE="${LOG_DIR}/git-backup.log"
LOCK_DIR="${TMPDIR:-/tmp}/portal-git-backup.lock"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

mkdir -p "${LOG_DIR}"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S %Z"
}

log() {
  printf "[%s] %s\n" "$(timestamp)" "$*" | tee -a "${LOG_FILE}"
}

fail() {
  log "ERROR: $*"
  exit 1
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "Another Portal Git backup is already running. Exiting."
  exit 0
fi

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

cd "${REPO_PATH}" || fail "Repo path does not exist: ${REPO_PATH}"

inside_work_tree="$(git rev-parse --is-inside-work-tree 2>/dev/null || true)"
[[ "${inside_work_tree}" == "true" ]] || fail "Not inside a Git work tree."

current_branch="$(git branch --show-current)"
[[ "${current_branch}" == "${BRANCH_NAME}" ]] || fail "Expected branch ${BRANCH_NAME}, found ${current_branch:-detached}."

remote_url="$(git remote get-url "${REMOTE_NAME}" 2>/dev/null || true)"
[[ -n "${remote_url}" ]] || fail "Remote ${REMOTE_NAME} is not configured."

log "Starting Portal Git backup. branch=${current_branch} remote=${remote_url} dry_run=${DRY_RUN}"

git fetch --quiet "${REMOTE_NAME}" "${BRANCH_NAME}" || fail "Fetch failed. No commit or push attempted."

local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse "${REMOTE_NAME}/${BRANCH_NAME}" 2>/dev/null || true)"
[[ -n "${remote_head}" ]] || fail "Could not resolve ${REMOTE_NAME}/${BRANCH_NAME}."

if ! git merge-base --is-ancestor "${REMOTE_NAME}/${BRANCH_NAME}" HEAD; then
  fail "Remote has commits not present locally. local=${local_head} remote=${remote_head}. No auto-merge or push attempted."
fi

changes="$(git status --porcelain)"
if [[ -z "${changes}" ]]; then
  log "No local changes to back up. local=${local_head} remote=${remote_head}"
  exit 0
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  log "Dry run: local changes detected, but no commit or push will be attempted."
  git status --short | tee -a "${LOG_FILE}"
  exit 0
fi

git add -A || fail "Staging failed. No commit or push attempted."

blocked_paths="$(
  git diff --cached --name-only |
    grep -E '(^|/)(\.env($|\.)|node_modules|portal-trading-site|tmp/|Users/|\.next|\.portal|\.venv|test-results|output/|__pycache__/)|\.pyc$|\.pem$|\.key$|\.p8$|\.p12$|id_rsa|id_ed25519' || true
)"

if [[ -n "${blocked_paths}" ]]; then
  fail "Blocked sensitive/runtime paths were staged. Review Git tracking manually: ${blocked_paths}"
fi

if git diff --cached --quiet; then
  log "No committable changes after staging. Nothing to push."
  exit 0
fi

commit_message="Automated Portal Git backup $(timestamp)"
git commit -m "${commit_message}" || fail "Commit failed. No push attempted."

git fetch --quiet "${REMOTE_NAME}" "${BRANCH_NAME}" || fail "Post-commit fetch failed. No push attempted."

if ! git merge-base --is-ancestor "${REMOTE_NAME}/${BRANCH_NAME}" HEAD; then
  fail "Remote advanced during backup. No auto-merge or push attempted."
fi

git push "${REMOTE_NAME}" "${BRANCH_NAME}" || fail "Push failed. Stopping without retry or force push."

new_head="$(git rev-parse HEAD)"
log "Portal Git backup pushed successfully. commit=${new_head}"
