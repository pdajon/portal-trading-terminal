# Portal Backups

This project has a local filesystem backup lane that does not depend on Git.

## What Gets Backed Up

`npm run backup` creates a timestamped source archive in the sibling folder:

`../portal-backups`

When iCloud Drive is available, the same backup is also mirrored to:

`~/Library/Mobile Documents/com~apple~CloudDocs/Portal Backups/portal-backups`

Set `PORTAL_BACKUP_MIRROR_DIR` to point the mirror at Dropbox, an external disk, or another synced folder instead.

The archive includes project source, docs, config, local Portal state, and env files. It skips generated or rebuildable folders:

- `node_modules`
- `.next`
- `.next-dev`
- `out`
- `output`
- `tmp`
- `.playwright-cli`
- `.venv-hl`
- nested generated folders under `portal-trading-site`
- `tsconfig.tsbuildinfo`

Each archive has a matching `.manifest.json` with file count, size, and SHA256 checksum. `latest-manifest.json` points to the newest backup.

Because `.env.local` is intentionally included for recovery, treat the backup and mirror folders as sensitive.

## Commands

Create a backup now:

```bash
npm run backup
```

Restore the latest backup into a new sibling folder:

```bash
npm run backup:restore
```

Install the periodic macOS backup schedule:

```bash
npm run backup:schedule
```

The scheduled job runs three times per day by default:

- `09:00`
- `14:00`
- `20:00`

It keeps the latest 96 source backups.

Create a backup without mirroring:

```bash
npm run backup -- --mirror-dir none
```

Use a custom mirror folder:

```bash
PORTAL_BACKUP_MIRROR_DIR="/Volumes/External Drive/Portal Backups/portal-backups" npm run backup
```

## Restore Safety

The restore command does not overwrite the live checkout. It extracts into:

`../portal-restores/portal-restore-YYYYMMDD-HHMMSS`

After restoring, compare the recovered folder against the live checkout before copying anything back.

Restore from the mirrored latest manifest:

```bash
npm run backup:restore -- --manifest "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Portal Backups/portal-backups/latest-manifest.json"
```

## Schedule Details

The installer writes this LaunchAgent:

`~/Library/LaunchAgents/com.portal.project-backup.plist`

Logs go to:

- `../portal-backups/launchd.stdout.log`
- `../portal-backups/launchd.stderr.log`

To stop the schedule:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.portal.project-backup.plist
```

To install the schedule with a custom mirror folder:

```bash
PORTAL_BACKUP_MIRROR_DIR="$HOME/Dropbox/Portal Backups/portal-backups" npm run backup:schedule
```

To install the schedule with custom run times:

```bash
PORTAL_BACKUP_SCHEDULE_TIMES="09:00,14:00,20:00" npm run backup:schedule
```
