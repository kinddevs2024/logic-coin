import { Slot } from "expo-router";

import { AdminSessionProvider } from "@/components/admin/admin-session";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout() {
  return (
    <AdminSessionProvider>
      <AdminShell>
        <Slot />
      </AdminShell>
    </AdminSessionProvider>
  );
}
