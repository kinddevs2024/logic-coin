import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";

const TERMS = [
  ["Своя карта", "Вы подтверждаете, что карта принадлежит вам либо вы законно вправе её использовать для получения выплаты."],
  ["Проверка", "Logic Coin проверяет баланс и заявку. Обычно обработка занимает до 12 часов, но банк может зачислять перевод дольше."],
  ["Безопасность", "Logic Coin не сохраняет полный номер карты или CVC. В заявке остаются бренд, имя владельца, срок и последние четыре цифры."],
  ["Ошибочные данные", "Заявка может быть отклонена, если данные неполные, карта недействительна или операция требует дополнительной проверки."],
  ["Отмена и возврат", "До выплаты сумма блокируется в балансе. При отклонении заявки она должна быть возвращена в доступный баланс."],
] as const;

export default function WithdrawalAgreementScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  return (
    <AppFrame>
      <ScreenHeader title="Условия выплаты" onBack={() => router.back()} />
      <GlassSurface variant="strong" intensity={76} style={styles.document}>
        <View style={[styles.documentIcon, { backgroundColor: theme.primarySoft }]}><Ionicons name="document-text-outline" size={26} color={String(theme.primary)} /></View>
        <View style={styles.titleCopy}><AppText variant="heading">Соглашение о заявке на выплату</AppText><AppText variant="caption" muted>Версия от 23 августа 2026 года</AppText></View>
        {TERMS.map(([title, copy], index) => <View key={title} style={[styles.term, index > 0 && { borderTopColor: theme.border }]}><View style={[styles.termNumber, { backgroundColor: theme.primarySoft }]}><AppText variant="caption" color={String(theme.primary)}>{index + 1}</AppText></View><View style={styles.termCopy}><AppText variant="label">{title}</AppText><AppText variant="caption" muted>{copy}</AppText></View></View>)}
        <View style={[styles.disclaimer, { backgroundColor: theme.primarySoft }]}><Ionicons name="information-circle-outline" size={20} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.textMuted)} style={styles.disclaimerCopy}>Этот документ описывает работу функции и согласие пользователя. Он не заменяет требования банка, платёжного провайдера, PCI DSS или применимого законодательства.</AppText></View>
      </GlassSurface>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  document: { borderRadius: 28, padding: 20, gap: 16 },
  documentIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  titleCopy: { gap: 3 },
  term: { paddingTop: 14, borderTopWidth: 1, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  termNumber: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  termCopy: { flex: 1, gap: 4 },
  disclaimer: { borderRadius: 17, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  disclaimerCopy: { flex: 1 },
});
