import { View } from "react-native";
export const supportsYoutubePlayer = true;
export function YoutubePlayer({ videoId }: { videoId: string }) {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  return <View style={{ width: "100%", height: 220, backgroundColor: "#000", borderRadius: 18, overflow: "hidden" }}>
    <iframe title="YouTube Live" src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" style={{ width: "100%", height: "100%", border: 0 }} />
  </View>;
}
