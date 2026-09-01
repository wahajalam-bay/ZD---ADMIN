# Backup & Restore

Two things hold state: **PostgreSQL** (all records) and the **object store**
(photo files). Both must be backed up; neither alone is a complete backup.

## PostgreSQL

**Daily dump** (cron on the DB host or a backup runner):

```bash
# /etc/cron.d/zameen-backup  →  02:30 daily
pg_dump "postgres://user:pass@db-host:5432/zameen_admin" \
  --format=custom --file=/backups/zameen_admin_$(date +%F).dump
```

**Retention guidance**: keep 14 daily, 8 weekly (Monday), 12 monthly dumps. Prune:

```bash
find /backups -name 'zameen_admin_*.dump' -mtime +14 -delete   # plus weekly/monthly rotation
```

Store copies off-host (object storage in another account/region works well).
Managed databases (RDS, DO Managed PG, etc.): enable automated snapshots with
point-in-time recovery **and** keep the daily logical dump for portability.

**Restore**:

```bash
createdb zameen_admin_restore
pg_restore --dbname=zameen_admin_restore --no-owner /backups/zameen_admin_2026-09-01.dump
# verify, then repoint DATABASE_URL / rename databases during a maintenance window
```

Always take a fresh dump immediately **before running migrations** during upgrades.

## Object storage (photos)

- **Disk volume** (this deployment): the media volume is a plain directory tree, so
  any file-level backup works. Nightly, alongside the database dump:

  ```bash
  tar -czf /backups/media-$(date +%F).tar.gz -C /srv/zameen media
  # or, for an incremental mirror to a second host:
  rsync -a --delete /srv/zameen/media/ backup-host:/backups/zameen/media/
  ```

  With docker compose the volume lives under `/var/lib/docker/volumes/zameen-admin_media`;
  prefer a bind mount (`-v /srv/zameen/media:/var/lib/zameen/media`) so backups are
  straightforward.

- **If you later move to an object store**: enable bucket **versioning** so deletions/overwrites are
  recoverable; add a lifecycle rule to expire old versions (e.g. 90 days). Optionally
  replicate to a second bucket/region.
- **Self-hosted MinIO**: mirror daily to a second location:
  `mc mirror --overwrite local/zameen-admin-media backup/zameen-admin-media`
  and back up the MinIO data volume with the host backup.
- Object keys are referenced from PostgreSQL — restore the database and the media store
  to points in time as close together as possible. A missing object shows as a
  broken image; a missing DB row makes an object orphaned (harmless).

## Restore drill

Do a quarterly test restore into a scratch database + media directory, boot the app against
them (`DATABASE_URL`, `STORAGE_MEDIA_PATH`), sign in, and spot-check a published week including
photo evidence.
