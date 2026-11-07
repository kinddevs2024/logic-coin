import { memo, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useQRCodeData } from "react-native-qrcode-styled";
import Svg, { Defs, G, Image, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { qrModulePath } from "@/lib/qr-module-path";

const options = { errorCorrectionLevel: "H" as const };
const logo = require("../../assets/brand/logo-qr.png");

/** One native path, rather than a React/SVG subtree for every QR module. */
export const InviteQr = memo(function InviteQr({ value, size = 220 }: { value: string; size?: number }) {
  const { width } = useWindowDimensions();
  const qrSize = Math.min(size, Math.max(156, width - 136));
  const { bitMatrix, qrCodeSize } = useQRCodeData(value, options);
  const path = useMemo(() => qrModulePath(bitMatrix), [bitMatrix]);
  const extent = qrSize + 56;
  const logoSize = qrSize * 0.37;
  const eyes = [[0, 0], [qrCodeSize - 7, 0], [0, qrCodeSize - 7]];
  return <Svg width={extent} height={extent} viewBox={`0 0 ${extent} ${extent}`}>
    <Defs><LinearGradient id="inviteInk" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#007A57" /><Stop offset="1" stopColor="#006345" /></LinearGradient></Defs>
    <Rect width={extent} height={extent} rx={22} fill="#FFFFFF" />
    {qrCodeSize > 0 ? <G transform={`translate(28 28) scale(${qrSize / qrCodeSize})`}>
      <Path d={path} fill="url(#inviteInk)" />
      {eyes.map(([x, y], index) => <G key={index} transform={`translate(${x} ${y})`}>
        <Rect width={7} height={7} rx={1.5} fill="url(#inviteInk)" />
        <Rect x={1} y={1} width={5} height={5} rx={0.8} fill="#FFFFFF" />
        <Rect x={2} y={2} width={3} height={3} rx={0.6} fill="url(#inviteInk)" />
      </G>)}
    </G> : null}
    {/* No rectangular cut-out: QR ink remains visible in every transparent part. */}
    <Image href={logo} x={(extent - logoSize) / 2} y={(extent - logoSize) / 2} width={logoSize} height={logoSize} preserveAspectRatio="xMidYMid meet" />
  </Svg>;
});
