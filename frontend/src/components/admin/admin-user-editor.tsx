import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { CopyTextInput as TextInput, useUiCopy } from "@/components/localized-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi, type AdminUser } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

const moderationCopy = {
  ru: {
    title: "Модерация", chat: "Отправка сообщений", allowed: "Может писать в чатах", restricted: "Отправка сообщений запрещена",
    restrict: "Запретить писать в чатах", allow: "Разрешить писать в чатах", reason: "Причина изменения доступа к чатам",
    loading: "Проверяем доступ к чатам…", loadError: "Не удалось проверить доступ к чатам", retry: "Повторить",
    changeError: "Не удалось изменить доступ к чатам", protected: "Доступ к чатам Owner и Admin защищён",
  },
  en: {
    title: "Moderation", chat: "Sending messages", allowed: "Can send chat messages", restricted: "Chat messages are restricted",
    restrict: "Restrict sending messages", allow: "Allow sending messages", reason: "Reason for changing chat permissions",
    loading: "Checking chat permissions…", loadError: "Could not check chat permissions", retry: "Retry",
    changeError: "Could not change chat permissions", protected: "Owner and Admin chat permissions are protected",
  },
  uz: {
    title: "Moderatsiya", chat: "Xabar yuborish", allowed: "Chatlarda xabar yubora oladi", restricted: "Chatlarda xabar yuborish taqiqlangan",
    restrict: "Chatlarda yozishni taqiqlash", allow: "Chatlarda yozishga ruxsat berish", reason: "Chat ruxsatini o‘zgartirish sababi",
    loading: "Chat ruxsati tekshirilmoqda…", loadError: "Chat ruxsatini tekshirib bo‘lmadi", retry: "Qayta urinish",
    changeError: "Chat ruxsatini o‘zgartirib bo‘lmadi", protected: "Owner va Admin chat ruxsatlari himoyalangan",
  },
} as const;

const roles = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const;

const confirmationCopy = {
  ru: {
    ban: "Подтвердить блокировку",
    banEffect: "Пользователь потеряет доступ к аккаунту. Связанные устройства и IP-адреса будут заблокированы.",
    delete: "Подтвердить удаление",
    deleteEffect: "Профиль будет удалён, а финансовые записи обезличены. Восстановить профиль нельзя.",
    cancel: "Не выполнять",
    contact: "Показать контакт Telegram",
    missingContact: "Подтверждённого контакта Telegram нет",
    contactError: "Не удалось загрузить контакт Telegram",
  },
  en: {
    ban: "Confirm account block",
    banEffect: "The user will lose access to the account. Associated devices and IP addresses will be blocked.",
    delete: "Confirm deletion",
    deleteEffect: "The profile will be deleted and financial records anonymized. The profile cannot be restored.",
    cancel: "Cancel action",
    contact: "Show Telegram contact",
    missingContact: "No verified Telegram contact",
    contactError: "Could not load Telegram contact",
  },
  uz: {
    ban: "Bloklashni tasdiqlash",
    banEffect: "Foydalanuvchi hisobga kira olmaydi. Bog‘langan qurilmalar va IP manzillar bloklanadi.",
    delete: "O‘chirishni tasdiqlash",
    deleteEffect: "Profil o‘chiriladi va moliyaviy yozuvlar shaxssizlantiriladi. Profilni tiklab bo‘lmaydi.",
    cancel: "Amalni bekor qilish",
    contact: "Telegram kontaktini ko‘rsatish",
    missingContact: "Tasdiqlangan Telegram kontakti yo‘q",
    contactError: "Telegram kontaktini yuklab bo‘lmadi",
  },
} as const;

function editableProfile(user: AdminUser) {
  return {
    name: user.name,
    email: user.email ?? "",
    ...(user.countryCode ? { countryCode: user.countryCode } : {}),
    avatarUrl: user.avatarUrl ?? "",
    preferences: user.preferences,
    wallet: { availableUnits: user.wallet?.availableUnits ?? 0 },
    coins: { balance: user.coins?.balance ?? 0 },
  };
}

function editableVersion(user: AdminUser) {
  return JSON.stringify({ ...editableProfile(user), username: user.username ?? "" });
}

type Props = {
  user: AdminUser;
  token: string;
  onClose: () => void;
  onChanged?: (user: AdminUser | null) => void;
};

export function AdminUserEditor({ user, token, onClose, onChanged }: Props) {
  const { language, copyText, copyContent } = useUiCopy();
  const moderation = moderationCopy[language];
  const copy = confirmationCopy[language];
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const ownId = useAppStore(state => state.user.id);
  const [current, setCurrent] = useState(user);
  const [nickname, setNickname] = useState(user.username ?? "");
  const [role, setRole] = useState(user.role);
  const [draft, setDraft] = useState(() => JSON.stringify(editableProfile(user), null, 2));
  const [reason, setReason] = useState("");
  const [moderationReason, setModerationReason] = useState("");
  const [error, setError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [moderationError, setModerationError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"ban" | "delete" | null>(null);
  const [contactShown, setContactShown] = useState(false);
  const targetId = user._id;
  const canChangeChatAccess = targetId !== ownId && (current.role === "user" || current.role === "manager");
  const banKey = ["admin", "user-ban", targetId, token] as const;
  const restrictionKey = ["admin", "user-chat-restriction", targetId, token] as const;
  const ban = useQuery({ queryKey: banKey, queryFn: () => adminApi.banStatus(targetId, token) });
  const restriction = useQuery({
    queryKey: restrictionKey,
    queryFn: () => adminApi.chatRestriction(targetId, token),
    enabled: canChangeChatAccess,
  });
  const contact = useQuery({
    queryKey: ["admin", "telegram-contact", targetId, token],
    queryFn: () => adminApi.telegramContact(targetId, token),
    enabled: contactShown,
  });
  const input = [styles.input, { color: theme.text, borderColor: theme.border }];
  const errorColor = String(theme.danger);

  function reconcile(latest: AdminUser) {
    // Keep the revision that guards an unsaved draft if another operator edited the profile.
    setCurrent(previous => editableVersion(previous) === editableVersion(latest)
      ? latest
      : { ...previous, role: latest.role });
    onChanged?.(latest);
  }

  async function save() {
    if (busy || reason.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminApi.editUser(targetId, {
        expectedUpdatedAt: current.updatedAt,
        reason: reason.trim(),
        profile: { ...JSON.parse(draft), username: nickname },
      }, token);
      onChanged?.(result.user);
      onClose();
    } catch (failure) {
      setError(failure instanceof SyntaxError
        ? "Проверьте JSON: неверный формат данных."
        : failure instanceof Error ? failure.message : "Не удалось сохранить изменения.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRole() {
    if (busy || role === current.role || reason.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminApi.changeRole(targetId, { role, expectedRole: current.role, reason: reason.trim() }, token);
      reconcile(result.user);
      setNotice("Роль изменена. Новые права действуют сразу.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось изменить роль");
    } finally {
      setBusy(false);
    }
  }

  async function changeChatAccess() {
    const reasonText = moderationReason.trim();
    if (busy || !canChangeChatAccess || !restriction.data || reasonText.length < 3 || reasonText.length > 240) return;
    setBusy(true);
    setModerationError("");
    try {
      const result = await adminApi.setChatRestriction(targetId, !restriction.data.restricted, reasonText, token);
      queryClient.setQueryData(restrictionKey, result);
      setModerationReason("");
      // Chat restriction is stored on the user and may advance its profile revision.
      const latest = await adminApi.userDetails(targetId, token).catch(() => null);
      if (latest) reconcile(latest.user);
    } catch (failure) {
      setModerationError(failure instanceof Error ? failure.message : moderation.changeError);
    } finally {
      setBusy(false);
    }
  }

  async function moderateAccount(action: "ban" | "unban" | "delete") {
    if (busy || targetId === ownId || (action !== "unban" && confirmation !== action)) return;
    setBusy(true);
    setAccountError("");
    try {
      if (action === "ban") {
        const result = await adminApi.banUser(targetId, "Блокировка администратором", token);
        queryClient.setQueryData(banKey, { ...result, reason: "Блокировка администратором" });
        setNotice(`Заблокировано: устройств ${result.deviceCount}, IP ${result.ipCount}.`);
      } else if (action === "unban") {
        await adminApi.unbanUser(targetId, "Разблокировка администратором", token);
        queryClient.setQueryData(banKey, { banned: false, deviceCount: 0, ipCount: 0, reason: null });
        setNotice("Пользователь разблокирован.");
      } else {
        await adminApi.deleteUser(targetId, "Удаление администратором", token);
        setConfirmation(null);
        onChanged?.(null);
        onClose();
        return;
      }
      setConfirmation(null);
      onChanged?.(current);
    } catch (failure) {
      setAccountError(failure instanceof Error ? failure.message : "Операция не выполнена");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.backdrop}>
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.surfaceRaised }]}>
            <AppText variant="heading">{copyContent(`Редактирование: ${current.name}`)}</AppText>
            {notice ? <AppText accessibilityLiveRegion="polite">{copyContent(notice)}</AppText> : null}

            <View style={[styles.section, { borderColor: theme.border }]}>
              <AppText variant="heading">{moderation.title}</AppText>
              <AppText variant="label">{moderation.chat}</AppText>
              {!canChangeChatAccess ? <AppText muted>{moderation.protected}</AppText>
                : restriction.isPending ? <AppText muted>{moderation.loading}</AppText>
                : restriction.isError ? <>
                  <AppText accessibilityRole="alert" color={errorColor}>{moderation.loadError}</AppText>
                  <AppButton variant="ghost" disabled={busy || restriction.isFetching} onPress={() => void restriction.refetch()}>
                    {moderation.retry}
                  </AppButton>
                </> : <>
                  <AppText accessibilityLiveRegion="polite" color={restriction.data.restricted ? errorColor : undefined}>
                    {restriction.data.restricted ? moderation.restricted : moderation.allowed}
                  </AppText>
                  {restriction.data.restricted && restriction.data.reason ? <AppText muted>{restriction.data.reason}</AppText> : null}
                  <TextInput accessibilityLabel={moderation.reason} placeholder={moderation.reason} placeholderTextColor={String(theme.textMuted)}
                    style={input} value={moderationReason} onChangeText={setModerationReason} maxLength={240} editable={!busy} />
                  <AppButton variant={restriction.data.restricted ? "secondary" : "danger"}
                    disabled={busy || restriction.isFetching || moderationReason.trim().length < 3} onPress={() => void changeChatAccess()}>
                    {restriction.data.restricted ? moderation.allow : moderation.restrict}
                  </AppButton>
                  {moderationError ? <AppText accessibilityRole="alert" color={errorColor}>{copyContent(moderationError)}</AppText> : null}
                </>}
              <AppText variant="label">{copyText("Блокировка и удаление")}</AppText>
              {ban.isPending ? <AppText>{copyText("Загрузка…")}</AppText>
                : ban.isError ? <>
                  <AppText accessibilityRole="alert" color={errorColor}>{copyText("Статус блокировки недоступен")}</AppText>
                  <AppButton variant="ghost" disabled={busy || ban.isFetching} onPress={() => void ban.refetch()}>{moderation.retry}</AppButton>
                </>
                : <AppButton disabled={busy || ban.isFetching || confirmation !== null || targetId === ownId}
                    onPress={() => {
                      if (ban.data.banned) void moderateAccount("unban");
                      else { setAccountError(""); setConfirmation("ban"); }
                    }}>
                  {copyText(ban.data.banned ? "Разблокировать пользователя" : "Заблокировать пользователя")}
                </AppButton>}
              <AppButton disabled={busy || confirmation !== null || targetId === ownId} onPress={() => { setAccountError(""); setConfirmation("delete"); }}>
                {copyText("Удалить пользователя")}
              </AppButton>
              {confirmation ? <View style={styles.actions}>
                <AppText accessibilityLiveRegion="polite">{confirmation === "ban" ? copy.banEffect : copy.deleteEffect}</AppText>
                <AppButton variant="danger" disabled={busy} onPress={() => void moderateAccount(confirmation)}>
                  {confirmation === "ban" ? copy.ban : copy.delete}
                </AppButton>
                <AppButton variant="ghost" disabled={busy} onPress={() => { setAccountError(""); setConfirmation(null); }}>{copy.cancel}</AppButton>
              </View> : null}
              {accountError ? <AppText accessibilityRole="alert" color={errorColor}>{copyContent(accountError)}</AppText> : null}
            </View>

            {!contactShown ? <AppButton variant="secondary" disabled={busy} onPress={() => setContactShown(true)}>{copy.contact}</AppButton>
              : contact.isPending ? <AppText muted>{copyText("Загрузка…")}</AppText>
              : contact.isError ? <>
                <AppText accessibilityRole="alert" color={errorColor}>{copy.contactError}</AppText>
                <AppButton variant="ghost" disabled={busy || contact.isFetching} onPress={() => void contact.refetch()}>{moderation.retry}</AppButton>
              </> : contact.data.contact ? (
                <View style={[styles.section, { borderColor: theme.border, backgroundColor: theme.primarySoft }]}>
                  <AppText variant="label">Telegram · {contact.data.contact.username ? `@${contact.data.contact.username}` : contact.data.contact.telegramId}</AppText>
                  <AppText selectable>{contact.data.contact.phoneNumber ?? copyText("Номер ещё не предоставлен")}</AppText>
                  <AppText variant="caption" muted>{copyText("Контакт подтверждён пользователем")}</AppText>
                </View>
              ) : <AppText muted>{copy.missingContact}</AppText>}

            <AppText>{copyText("Имя, email, страна, аватар, настройки, доступные деньги и коины. Идентификаторы входа, резерв вывода и история защищены от изменения.")}</AppText>
            <AppText variant="label">{copyText("Никнейм (@username)")}</AppText>
            <TextInput accessibilityLabel="Никнейм (@username)" style={input} placeholder={copyText("Например: umar_2026")}
              placeholderTextColor={String(theme.textMuted)} value={nickname} onChangeText={setNickname}
              autoCapitalize="none" autoCorrect={false} maxLength={25} editable={!busy} />
            <AppText variant="caption" muted>{copyText("Никнейм для поиска в чатах: 4–24 латинских буквы, цифры или _, начинается с буквы. Пустое поле удалит никнейм.")}</AppText>
            <AppText variant="caption" muted>{copyText("Деньги вводятся в центах: 1000 = $10.")}</AppText>
            <TextInput accessibilityLabel="Данные профиля" multiline style={[input, styles.draft]} value={draft} onChangeText={setDraft} editable={!busy} />

            <AppText variant="label">{copyText("Роль платформы")}</AppText>
            <View style={styles.roles}>
              {roles.map(item => <Pressable key={item.value} disabled={busy} accessibilityRole="radio"
                accessibilityState={{ checked: role === item.value }} onPress={() => setRole(item.value)}
                style={[styles.role, { backgroundColor: role === item.value ? theme.primarySoft : theme.surface }]}>
                <AppText>{item.label}</AppText>
              </Pressable>)}
            </View>
            <AppText variant="caption" muted>{copyText("Manager — переписка со всеми. Admin — управление. Owner — управление, отчёты и переписка.")}</AppText>
            <TextInput style={input} accessibilityLabel="Причина изменения (обязательно)" placeholder={copyText("Причина изменения (обязательно)")}
              placeholderTextColor={String(theme.textMuted)} value={reason} onChangeText={setReason} maxLength={240} editable={!busy} />
            {error ? <AppText accessibilityRole="alert" color={errorColor}>{copyContent(error)}</AppText> : null}
            <AppButton variant="secondary" disabled={busy || role === current.role || reason.trim().length < 3} onPress={() => void saveRole()}>
              {copyText("Сохранить роль")}
            </AppButton>
            <AppButton disabled={busy || reason.trim().length < 3} onPress={() => void save()}>{copyText("Подтвердить и сохранить")}</AppButton>
            <AppButton variant="ghost" disabled={busy} onPress={onClose}>{copyText("Отмена")}</AppButton>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", padding: 16, justifyContent: "center" },
  scroll: { maxHeight: "94%", flexGrow: 0 },
  scrollContent: { alignItems: "center" },
  panel: { width: "100%", maxWidth: 660, padding: 16, borderRadius: 20, gap: 12 },
  section: { gap: 8, padding: 12, borderWidth: 1, borderRadius: 16 },
  actions: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46 },
  draft: { minHeight: 300, textAlignVertical: "top" },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  role: { padding: 12, borderRadius: 12 },
});
