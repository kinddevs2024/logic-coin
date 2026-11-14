import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { CopyTextInput as TextInput, useUiCopy } from "@/components/localized-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { detectCardBrand, formatCardNumber, formatExpiration, isValidCardNumber, isValidExpiration, type PaymentCardBrand } from "@/lib/payment-card";
import { accentForeground } from "@/lib/theme-colors";

const logos = {
  visa: require("../../assets/payment-cards/visa.png"),
  mastercard: require("../../assets/payment-cards/mastercard.png"),
  uzcard: require("../../assets/payment-cards/uzcard.png"),
  humo: require("../../assets/payment-cards/humo.png"),
};
const brandNames = { visa: "Visa", mastercard: "Mastercard", uzcard: "Uzcard", humo: "Humo", other: "Банковская карта" };

type PaymentCardProps = {
  cardNumber: string;
  /** A private label, never the legal cardholder name or a payout field. */
  holderName: string;
  expiration: string;
  savedLast4?: string;
  savedBrand?: PaymentCardBrand;
  readOnly?: boolean;
  onCardNumberChange: (value: string) => void;
  onHolderNameChange: (value: string) => void;
  onExpirationChange: (value: string) => void;
};

export function PaymentCard({ cardNumber, holderName, expiration, savedLast4, savedBrand, readOnly = false, onCardNumberChange, onHolderNameChange, onExpirationChange }: PaymentCardProps) {
  const { copyText } = useUiCopy();
  const theme = useAppTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState(320);
  const [focused, setFocused] = useState(false);
  const [numberTouched, setNumberTouched] = useState(false);
  const brand = readOnly && savedBrand ? savedBrand : detectCardBrand(cardNumber);
  const displayedNumber = readOnly && savedLast4 ? `•••• •••• •••• ${savedLast4}` : cardNumber;
  const background = String(theme.mode === "dark" || theme.mode === "graphite" ? theme.surfaceRaised : theme.primary);
  const foreground = accentForeground(background, "dark");
  const numberInvalid = !readOnly && numberTouched && Boolean(cardNumber) && !isValidCardNumber(cardNumber);
  const expirationInvalid = !readOnly && Boolean(expiration) && !isValidExpiration(expiration);
  const logo = brand === "other" ? null : logos[brand];
  const optionalInput = [styles.optionalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }];

  return (
    <View style={styles.container}>
      <View testID="payment-card" onLayout={event => setCardWidth(event.nativeEvent.layout.width)} style={[styles.card, { backgroundColor: background, borderColor: focused ? theme.primary : theme.border, shadowColor: theme.shadow }, focused && styles.focused]}>
        <View style={styles.cardTop}>
          <AppText style={[styles.wordmark, { color: foreground }]}>Logic Coin.</AppText>
          <MaterialCommunityIcons name="contactless-payment" size={27} color={foreground} />
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.cardContent}>
            {holderName.trim() || expiration ? <View style={styles.metadata}>
              <AppText numberOfLines={1} style={[styles.privateLabel, { color: foreground }]}>{holderName.trim()}</AppText>
              {expiration ? <AppText style={[styles.expiration, { color: foreground }]}>{expiration}</AppText> : null}
            </View> : null}
            <TextInput
              accessibilityLabel={copyText("Номер банковской карты")}
              accessibilityHint={copyText("Введите 16 цифр")}
              aria-invalid={numberInvalid}
              editable={!readOnly}
              value={displayedNumber}
              onChangeText={value => onCardNumberChange(formatCardNumber(value))}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); setNumberTouched(true); }}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="cc-number"
              textContentType="creditCardNumber"
              maxLength={19}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor={foreground === "#FFFFFF" ? "rgba(255,255,255,0.68)" : "rgba(8,23,45,0.65)"}
              selectionColor={foreground}
              style={[styles.cardNumber, { color: foreground, fontSize: Math.min(21, (cardWidth - 96) / 10.7) }]}
            />
          </View>
          <View accessibilityLabel={copyText(brandNames[brand])} accessibilityRole="image" style={styles.logoWrap}>
            {logo ? <Image source={logo} resizeMode="contain" style={styles.logo} /> : <Ionicons name="card-outline" size={30} color={foreground} />}
          </View>
        </View>
      </View>
      {numberInvalid ? <AppText variant="caption" color={String(theme.danger)} accessibilityLiveRegion="polite">{copyText("Проверьте номер: нужны 16 цифр действующей карты")}</AppText> : null}
      {!readOnly ? <>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen || expirationInvalid }} onPress={() => setDetailsOpen(value => !value)} style={({ pressed }) => [styles.detailsToggle, { borderColor: theme.border }, pressed && styles.pressed]}>
          <View style={styles.detailsTitle}><AppText variant="label">{copyText("Название и срок действия")}</AppText><AppText variant="caption" muted>{copyText("Необязательно")}</AppText></View>
          <Ionicons name={detailsOpen || expirationInvalid ? "chevron-up" : "chevron-down"} size={18} color={String(theme.textMuted)} />
        </Pressable>
        {detailsOpen || expirationInvalid ? <View style={styles.optionalFields}>
          <View style={styles.optionalField}>
            <AppText variant="caption" muted>{copyText("Название карты для себя")}</AppText>
            <TextInput accessibilityLabel={copyText("Название карты для себя")} value={holderName} onChangeText={onHolderNameChange} maxLength={40} autoComplete="off" placeholder={copyText("Например, моя основная карта")} placeholderTextColor={String(theme.textMuted)} style={optionalInput} />
          </View>
          <View style={styles.optionalField}>
            <AppText variant="caption" muted>{copyText("Срок действия · необязательно")}</AppText>
            <TextInput accessibilityLabel={copyText("Срок действия карты")} aria-invalid={expirationInvalid} value={expiration} onChangeText={value => onExpirationChange(formatExpiration(value))} keyboardType="number-pad" inputMode="numeric" autoComplete="cc-exp" maxLength={5} placeholder="MM/YY" placeholderTextColor={String(theme.textMuted)} style={optionalInput} />
            {expirationInvalid ? <AppText variant="caption" color={String(theme.danger)} accessibilityLiveRegion="polite">{copyText("Укажите действующий срок в формате MM/YY или оставьте поле пустым")}</AppText> : null}
          </View>
        </View> : null}
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, width: "100%", maxWidth: 420, alignSelf: "center" },
  captionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  info: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  card: { width: "100%", aspectRatio: 1.67, borderRadius: 18, padding: 20, borderWidth: 1, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4, justifyContent: "space-between" },
  focused: { borderWidth: 2, padding: 19 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { fontSize: 19, lineHeight: 25, fontWeight: "700", letterSpacing: -0.6 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  cardContent: { flex: 1, minWidth: 0, gap: 3 },
  metadata: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  privateLabel: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  expiration: { fontSize: 12, lineHeight: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  cardNumber: { width: "100%", minWidth: 0, minHeight: 44, backgroundColor: "transparent", borderWidth: 0, fontSize: 19, fontWeight: "600", letterSpacing: 0.5, padding: 0, fontVariant: ["tabular-nums"], ...Platform.select({ web: { outlineWidth: 0, outlineStyle: "solid" as const }, default: {} }) },
  logoWrap: { width: 48, height: 32, borderRadius: 5, overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  logo: { width: 48, height: 32, backgroundColor: "#FFFFFF" },
  hint: { flex: 1, lineHeight: 18 },
  detailsToggle: { minHeight: 54, borderTopWidth: 1, marginTop: 8, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  detailsTitle: { flex: 1, gap: 2 },
  optionalFields: { gap: 12, paddingTop: 4 },
  optionalField: { gap: 6 },
  optionalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 15 },
  pressed: { opacity: 0.72 },
});
