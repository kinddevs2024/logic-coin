import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { authenticatedRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { Wallet } from "@/types";
export function useAccountWallet() {
  const token = useAppStore((s) => s.accessToken),
    focused = useIsFocused();
  return useQuery({
    queryKey: ["account-wallet", token],
    queryFn: () =>
      authenticatedRequest<{ wallet: Wallet }>("/wallet", { token: token! }),
    enabled: Boolean(token) && focused,
    staleTime: 15000,
    refetchOnMount: "always",
  });
}
