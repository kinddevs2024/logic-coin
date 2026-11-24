import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
const pages = [
 ["/owner/overview", "Обзор", "Пользователи и активность за выбранный день"],
 ["/owner/finance", "Финансы", "Доходы, расходы и баланс платформы"],
 ["/owner/credits", "Денежные начисления", "Фонд челленджа и начисления по источникам"],
 ["/owner/withdrawals", "Выводы", "Заявки, карты и подтверждение выплат"],
 ["/owner/challenges", "Челленджи", "Игры и фонды по дням"],
 ["/owner/prizes", "Призы", "Получатели денежных наград"],
 ["/owner/rating", "Рейтинг", "Поиск игрока и история начислений coin"],
] as const;
export default function OwnerHome() { const router=useRouter(); return <View style={{gap:16}}><AppText variant="heading">Отчёты владельца</AppText><AppText muted>Выберите раздел, чтобы посмотреть подробности.</AppText><View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>{pages.map(([href,title,description])=><Pressable key={href} accessibilityRole="link" onPress={()=>router.push(href as never)} style={{minWidth:220,flexGrow:1,flexBasis:260}}><GlassSurface style={{padding:20,borderRadius:20,gap:8}}><AppText variant="label">{title} →</AppText><AppText muted>{description}</AppText></GlassSurface></Pressable>)}</View></View>; }
