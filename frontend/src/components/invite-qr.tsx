import QRCodeStyled from "react-native-qrcode-styled";
import { useWindowDimensions } from "react-native";

/** A real QR matrix: styling never substitutes the generated reference's pattern. */
export function InviteQr({ value, size = 220 }: { value: string; size?: number }) {
  const { width } = useWindowDimensions();
  const qrSize = Math.min(size, Math.max(156, width - 136));
  return (
    <QRCodeStyled
      data={value}
      size={qrSize}
      padding={28}
      errorCorrectionLevel="H"
      color="#0044DD"
      style={{ backgroundColor: "#FFFFFF", borderRadius: 22 }}
      pieceBorderRadius={2}
      isPiecesGlued
      gradient={{ type: "linear", options: { colors: ["#007BFF", "#0030CB"], start: [0, 0], end: [1, 1] } }}
      outerEyesOptions={{ borderRadius: 12, stroke: "#00BCEB", strokeWidth: 1.2 }}
      innerEyesOptions={{ borderRadius: 6 }}
      logo={{ href: require("../../assets/brand/logo-mark.png"), scale: 0.9, padding: 4, hidePieces: true }}
    />
  );
}
