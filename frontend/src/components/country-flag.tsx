import {useState} from "react";
import {AppText} from "@/components/app-text";
import {useAppTheme} from "@/hooks/use-app-theme";
import {countryFlags} from "@/constants/country-flags";
import { Image, StyleSheet, View } from "react-native";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import ruLocale from "i18n-iso-countries/langs/ru.json";
import uzLocale from "i18n-iso-countries/langs/uz.json";

import type { Language } from "@/types";

countries.registerLocale(enLocale);
countries.registerLocale(ruLocale);
countries.registerLocale(uzLocale);

export type CountryOption = { code: string; name: string };

export function countryOptions(language: Language = "ru"): CountryOption[] {
  const names = countries.getNames(language, { select: "official" });
  return Object.keys(countries.getAlpha2Codes())
    .map((code) => ({ code, name: names[code] ?? countries.getName(code, "en") ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
}

export function countryName(countryCode: string | null | undefined, language: Language = "ru") {
  if (!countryCode) return language === "ru" ? "Страна не указана" : language === "uz" ? "Mamlakat ko‘rsatilmagan" : "Country not set";
  const code = countryCode.toUpperCase();
  return countries.getName(code, language) ?? countries.getName(code, "en") ?? code;
}

export function CountryFlagBadge({countryCode,size=28}: {countryCode?:string|null;size?:number}) {
  const code = countryCode?.trim().toUpperCase();
  return code ? <FlagImage key={code} code={code} size={size}/> : null;
}
function FlagImage({code,size}: {code:string;size:number}) {
  const theme=useAppTheme();
  const [failed,setFailed]=useState(false);
  const source=countryFlags[code];
  return <View accessibilityLabel={countryName(code)} style={{height:size,width:Math.round(size*1.6),borderRadius:Math.max(2,Math.round(size*0.14)),overflow:"hidden",backgroundColor:theme.primarySoft,alignItems:"center",justifyContent:"center"}}>
    <AppText style={{fontSize:Math.max(8,size*0.42),lineHeight:size,color:theme.textMuted}}>{code}</AppText>
    {source && !failed ? <Image source={source} resizeMode="contain" onError={()=>setFailed(true)} style={[StyleSheet.absoluteFill, {width:Math.round(size*1.6),height:size}]}/> : null}
  </View>;
}

