import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { detectCardBrand, formatCardNumber, formatExpiration, type PaymentCardBrand } from "@/lib/payment-card";

type PaymentCardProps = {
  cardNumber: string;
  holderName: string;
  expiration: string;
  savedLast4?: string;
  savedBrand?: PaymentCardBrand;
  readOnly?: boolean;
  onCardNumberChange: (value: string) => void;
  onHolderNameChange: (value: string) => void;
  onExpirationChange: (value: string) => void;
};

export function PaymentCard({
  cardNumber,
  holderName,
  expiration,
  savedLast4,
  savedBrand,
  readOnly = false,
  onCardNumberChange,
  onHolderNameChange,
  onExpirationChange,
}: PaymentCardProps) {
  const focus = useSharedValue(0);
  const brand = savedBrand ?? detectCardBrand(cardNumber);
  const displayedNumber = readOnly && savedLast4
    ? `•••• •••• •••• ${savedLast4}`
    : cardNumber;

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { scale: 1 + focus.value * 0.018 },
      { rotateX: `${focus.value * -1.2}deg` },
      { rotateY: `${focus.value * 1.8}deg` },
    ],
  }));

  const activate = () => {
    focus.value = withSpring(1, { damping: 17, stiffness: 190 });
  };
  const deactivate = () => {
    focus.value = withSpring(0, { damping: 18, stiffness: 170 });
  };

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.card, cardStyle]}>
      <View style={styles.cardTop}>
        <View style={styles.chip}><Ionicons name="hardware-chip-outline" size={26} color="#DCEAFF" /></View>
        <View style={styles.brandWrap}>
          <Ionicons name="radio-outline" size={19} color="#DCEAFF" />
          <AppText style={styles.brand}>{brand === "other" ? "CARD" : brand.toUpperCase()}</AppText>
        </View>
      </View>

      <TextInput
        accessibilityLabel="Номер банковской карты"
        editable={!readOnly}
        value={displayedNumber}
        onChangeText={(value) => onCardNumberChange(formatCardNumber(value))}
        onFocus={activate}
        onBlur={deactivate}
        keyboardType="number-pad"
        autoComplete="cc-number"
        maxLength={23}
        placeholder="0000 0000 0000 0000"
        placeholderTextColor="rgba(235,244,255,0.45)"
        selectionColor="#8AC7FF"
        style={[styles.cardNumber, readOnly && styles.readOnly]}
      />

      <View style={styles.cardBottom}>
        <View style={styles.holderField}>
          <AppText style={styles.fieldLabel}>ВЛАДЕЛЕЦ</AppText>
          <TextInput
            accessibilityLabel="Имя владельца карты"
            editable={!readOnly}
            value={holderName}
            onChangeText={(value) => onHolderNameChange(value.toUpperCase().replace(/[^A-ZА-ЯЁ\s'-]/gi, "").slice(0, 80))}
            onFocus={activate}
            onBlur={deactivate}
            autoCapitalize="characters"
            placeholder="ИМЯ ФАМИЛИЯ"
            placeholderTextColor="rgba(235,244,255,0.45)"
            style={[styles.holderInput, readOnly && styles.readOnly]}
          />
        </View>
        <View style={styles.expirationField}>
          <AppText style={styles.fieldLabel}>СРОК</AppText>
          <TextInput
            accessibilityLabel="Срок действия карты"
            editable={!readOnly}
            value={expiration}
            onChangeText={(value) => onExpirationChange(formatExpiration(value))}
            onFocus={activate}
            onBlur={deactivate}
            keyboardType="number-pad"
            autoComplete="cc-exp"
            maxLength={5}
            placeholder="MM/YY"
            placeholderTextColor="rgba(235,244,255,0.45)"
            style={[styles.expirationInput, readOnly && styles.readOnly]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1.585,
    alignSelf: "center",
    borderRadius: 25,
    padding: 21,
    backgroundColor: "#101A31",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    shadowColor: "#126FFF",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 13 },
    elevation: 12,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: { width: 46, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "rgba(220,234,255,0.34)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  brandWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontWeight: "900", letterSpacing: 0.8 },
  cardNumber: { color: "#FFFFFF", fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: 1.15, paddingVertical: 7, outlineStyle: "none" } as never,
  readOnly: { opacity: 0.9 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  holderField: { flex: 1, minWidth: 0, gap: 2 },
  expirationField: { width: 72, gap: 2 },
  fieldLabel: { color: "rgba(235,244,255,0.58)", fontSize: 8, lineHeight: 11, fontWeight: "800", letterSpacing: 1.1 },
  holderInput: { color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "800", paddingVertical: 4, outlineStyle: "none" } as never,
  expirationInput: { color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "800", paddingVertical: 4, outlineStyle: "none" } as never,
});
