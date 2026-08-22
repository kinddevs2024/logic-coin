# Arcade group B

Native Expo/React Native ports of the supplied standalone games. No WebView or HTML runtime is used.

## Integration

```tsx
import { renderGameB, type ArcadeGameResult, type GameBId } from "@/games/arcade/b";

const gameId: GameBId = "pulse";

return renderGameB(gameId, {
  initialBest: 0,
  initialCoins: 0,
  onExit: () => router.back(),
  onFinish: (result: ArcadeGameResult) => saveResult(result),
});
```

`gamesB` is the ordered catalog. `gamesBById` is the direct lookup. Every definition exposes the same metadata fields, `component`, and `render(props)`.

`onFinish` receives `{ gameId, score, coins, won, durationMs, details }`. The host owns persistence and wallet conversion, so these isolated components do not import global routes, stores, or catalogs.
