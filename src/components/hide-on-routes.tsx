"use client";

import { usePathname } from "next/navigation";

/**
 * Cache ses enfants sur certaines routes. Patterns = strings :
 *   - "/auth" → match prefix (pathname.startsWith)
 *   - "regex:^/seance/[^/]+/live" → préfixé `regex:` → regex
 *
 * (On ne peut pas passer un RegExp d'un Server Component à un Client Component,
 * Next.js refuse les classes au boundary serveur→client.)
 */
export function HideOnRoutes({
  patterns,
  children,
}: {
  patterns: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const shouldHide = patterns.some((p) => {
    if (p.startsWith("regex:")) {
      try {
        return new RegExp(p.slice(6)).test(pathname);
      } catch {
        return false;
      }
    }
    return pathname.startsWith(p);
  });
  if (shouldHide) return null;
  return <>{children}</>;
}
