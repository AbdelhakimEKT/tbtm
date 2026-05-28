import {
  ChefHat,
  Crown,
  Dumbbell,
  Flame,
  HelpCircle,
  Star,
  Trophy,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy,
  Flame,
  Dumbbell,
  Weight,
  Zap,
  Crown,
  ChefHat,
  Star,
  HelpCircle,
};

export function getBadgeIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Trophy;
}

export function BadgeIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  const Icon = getBadgeIcon(iconName);
  return <Icon className={className} />;
}
