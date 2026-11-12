import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useUiCopy } from "@/components/localized-native";
import { detectCardBrand, formatCardNumber, type PaymentCardBrand } from "@/lib/payment-card";

type PaymentCardProps = {
  cardNumber: string;
  savedLast4?: string;
  savedBrand?: PaymentCardBrand;
  readOnly?: boolean;
  onCardNumberChange: (value: string) => void;
};

export function PaymentBrandLogo({ brand }: { brand: PaymentCardBrand }) {
  const label = brand === "other" ? "Банковская карта" : brand === "mastercard" ? "Mastercard" : brand.toUpperCase();
  return <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.logo}>
    {brand === "mastercard" ? <Svg width={58} height={36} viewBox="0 0 58 36"><Circle cx={21} cy={18} r={16} fill="#EB001B" /><Circle cx={37} cy={18} r={16} fill="#F79E1B" fillOpacity={0.94} /></Svg>
      : brand === "visa" ? <Svg width={72} height={34} viewBox="0 0 86 40"><SvgText x={2} y={31} fontSize={34} fontWeight="900" fontStyle="italic" fill="#FFFFFF">VISA</SvgText></Svg>
      : brand === "uzcard" ? <Svg width={80} height={34} viewBox="0 0 96 40"><Path d="M3 9h12v12H3z" fill="#00B2FF" /><Path d="M10 17h12v12H10z" fill="#FFAA34" /><SvgText x={28} y={26} fontSize={17} fontWeight="800" fill="#FFFFFF">UZCARD</SvgText></Svg>
      : brand === "humo" ? <Svg width={80} height={34} viewBox="0 0 96 40"><Path d="M3 25C17 24 18 8 27 7L19 20l10-4-12 15z" fill="#F5C35C" /><SvgText x={32} y={27} fontSize={19} fontWeight="800" fill="#FFFFFF">HUMO</SvgText></Svg>
      : <Ionicons name="card-outline" size={30} color="#E2E8F0" />}
  </View>;
}

// Material-style gradient surface and a single outlined card-number field.
export function PaymentCard({ cardNumber, savedLast4, savedBrand, readOnly = false, onCardNumberChange }: PaymentCardProps) {
  const { copyText } = useUiCopy();
  const { width } = useWindowDimensions();
  const brand = readOnly && savedBrand ? savedBrand : detectCardBrand(cardNumber);
  return <LinearGradient colors={["#334155", "#182334", "#0F172A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
    <View pointerEvents="none" style={styles.cardAccent} />
    <View style={styles.cardTop}>
      <View style={styles.chip}><Ionicons name="hardware-chip-outline" size={27} color="#E5D5A4" /></View>
      <PaymentBrandLogo brand={brand} />
    </View>
    <View style={styles.numberField}>
      <TextInput accessibilityLabel={copyText("Номер банковской карты")} editable={!readOnly}
        value={readOnly && savedLast4 ? `•••• •••• •••• ${savedLast4}` : cardNumber}
        onChangeText={value => onCardNumberChange(formatCardNumber(value.replace(/\D/g, "").slice(0, 16)))}
        keyboardType="number-pad" autoComplete="cc-number" maxLength={19}
        placeholder="0000 0000 0000 0000" placeholderTextColor="#94A3B8" selectionColor="#CBD5E1"
        style={[styles.cardNumber, { fontSize: width < 380 ? 16 : 19 }]} />
    </View>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 420, alignSelf: "center", minHeight: 180, borderRadius: 16, padding: 20, gap: 30, overflow: "hidden", borderWidth: 1, borderColor: "#475569", shadowColor: "#020617", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  cardAccent: { position: "absolute", width: 200, height: 200, borderRadius: 100, right: -70, top: -100, backgroundColor: "rgba(255,255,255,0.04)" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: { width: 44, height: 34, borderRadius: 8, borderWidth: 1, borderColor: "rgba(229,213,164,0.5)", backgroundColor: "rgba(229,213,164,0.1)", alignItems: "center", justifyContent: "center" },
  logo: { minWidth: 72, height: 36, alignItems: "flex-end", justifyContent: "center" },
  numberField: { borderWidth: 1, borderColor: "#64748B", borderRadius: 8, backgroundColor: "rgba(15,23,42,0.4)", paddingHorizontal: 12 },
  cardNumber: { width: "100%", minWidth: 0, color: "#FFFFFF", lineHeight: 28, fontWeight: "600", letterSpacing: 0.5, paddingVertical: 13, outlineStyle: "none" } as never,
});
