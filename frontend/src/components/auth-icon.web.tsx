import Svg, { Path, Rect } from "react-native-svg";

type AuthIconProps = { name: "arrow-forward" | "mail-outline" | "chevron-back"; size?: number; color?: string };
/** Small login icons render immediately without downloading an entire icon font. */
export default function AuthIcon({ name, size = 24, color = "currentColor" }: AuthIconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {name === "mail-outline" ? <><Rect x={3} y={5} width={18} height={14} rx={2} /><Path d="m3 6 9 7 9-7" /></> : <Path d={name === "chevron-back" ? "m15 5-7 7 7 7" : "M4 12h16m-7-7 7 7-7 7"} />}
  </Svg>;
}
