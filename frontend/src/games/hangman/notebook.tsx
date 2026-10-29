import { useUiCopy } from "@/components/localized-native";

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useAppStore } from '../../store/app-store';

export const ink = '#0879B7';
export const FontContext = createContext('Notebook');
const paper = require('../../../assets/hangman/paper-tile.png');

export function NotebookPaper({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[style, { overflow: 'hidden', backgroundColor: '#F8F7F3' }]}><View pointerEvents="none" style={StyleSheet.absoluteFill}>{[0, 1, 2].flatMap(row => [0, 1].map(col => <Image key={`${row}:${col}`} source={paper} style={{ position: 'absolute', top: row * 456, left: col * 456, width: 456, height: 456 }} />))}</View>{children}</View>;
}
export function Hand({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const fontFamily = useContext(FontContext);
  return <Text allowFontScaling={false} style={[{ color: ink, fontFamily }, style]}>{children}</Text>;
}
export function Circle({ icon, color, label, onPress, size = 88, disabled = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string; onPress: () => void; size?: number; disabled?: boolean }) {
  const { copyText } = useUiCopy();
  return <Pressable accessibilityRole="button" accessibilityLabel={copyText(label)} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ width: size, height: size, opacity: disabled ? 0.45 : 1, borderRadius: 100, borderWidth: 4, borderColor: '#101010', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF580', transform: [{ rotate: '-3deg' }] }}><Ionicons name={icon} size={size * 0.66} color={color} /></Pressable>;
}

// Match the game's 565 × 1190 drawing coordinates, including on small phones.
export function NotebookLayer({ children, onClose, priority = 1000 }: { children: ReactNode; onClose: () => void; priority?: number }) {
  const language = useAppStore(state => state.language);
  useFonts({ Notebook: require('../../../assets/hangman/Neucha.ttf'), NotebookLatin: require('../../../assets/hangman/ShadowsIntoLightTwo-Regular.ttf') });
  const [size, setSize] = useState({ width: 393, height: 830 });
  const scale = Math.min(size.width / 565, size.height / 1190);
  const content = <FontContext.Provider value={language === 'ru' ? 'Notebook' : 'NotebookLatin'}><View style={{ flex: 1, backgroundColor: '#0005' }} onLayout={e => setSize(e.nativeEvent.layout)}><View style={{ width: 565, height: 1190, position: 'absolute', left: (size.width - 565) / 2, top: (size.height - 1190) / 2, transform: [{ scale }] }}>{children}</View></View></FontContext.Provider>;
  return Platform.OS === 'android'
    ? <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { zIndex: priority, elevation: priority === 1000 ? 30 : 40 }]}>{content}</View>
    : <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>{content}</Modal>;
}

export const notebookPanel: ViewStyle = { position: 'absolute', left: 32, right: 32, top: 240, minHeight: 650, padding: 32, borderWidth: 4, borderColor: '#111', transform: [{ rotate: '-1deg' }] };
