export const dynamic = 'force-dynamic';

import { AppLayoutClient } from "./_app-layout-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
