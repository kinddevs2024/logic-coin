import { CreditsReport } from "@/components/admin/credits-report";
import { useAppStore } from "@/store/app-store";

export default function OwnerCreditsScreen() {
  const token = useAppStore(state => state.accessToken);
  return token ? <CreditsReport owner token={token} /> : null;
}
