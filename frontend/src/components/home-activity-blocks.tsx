// Native keeps its existing home layout. The web implementation is resolved by Metro.
import type { RefObject } from "react";
import type { View } from "react-native";
import type { TodayChallenges } from "@/types";
export type HomeActivityBlocksProps = { today?: TodayChallenges; pendingGameKey?: string | null; challengesTarget: RefObject<View | null> };
export function HomeActivityBlocks(_props: HomeActivityBlocksProps) { return null; }
