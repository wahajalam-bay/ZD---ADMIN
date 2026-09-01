/**
 * Badges live in one place (`status-badge.tsx`) so the workflow / tracking /
 * task / severity vocabularies stay consistent. This module re-exports them
 * for existing import sites.
 */
export {
  Badge,
  StatusBadge,
  TrackingBadge,
  TrackingDot,
  TaskStatusBadge,
  SeverityBadge,
  SourceStatusBadge,
  TRACKING_LABELS,
  type Tracking,
} from "./status-badge";
