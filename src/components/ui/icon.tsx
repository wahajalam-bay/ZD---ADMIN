import * as React from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  Images,
  Inbox,
  Info,
  ListChecks,
  Loader,
  PlugZap,
  Radio,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Siren,
  StickyNote,
  TriangleAlert,
  Users,
  Video,
  Wrench,
} from "lucide-react";

/**
 * Icon registry. Shared UI components take an icon NAME (a string) rather than
 * a component, because React Server Components cannot pass function props to
 * Client Components. One registry keeps the icon vocabulary consistent too.
 */
export const ICONS = {
  activity: Activity,
  alert: AlertTriangle,
  chart: BarChart3,
  property: Building2,
  calendar: CalendarDays,
  camera: Camera,
  check: Check,
  checkCircle: CheckCircle2,
  clipboard: ClipboardList,
  draft: FileEdit,
  images: Images,
  inbox: Inbox,
  info: Info,
  checklist: ListChecks,
  loader: Loader,
  plug: PlugZap,
  radio: Radio,
  returned: RotateCcw,
  scroll: ScrollText,
  shield: ShieldCheck,
  siren: Siren,
  note: StickyNote,
  warning: TriangleAlert,
  users: Users,
  video: Video,
  wrench: Wrench,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Cmp = ICONS[name];
  return <Cmp className={className} aria-hidden />;
}
