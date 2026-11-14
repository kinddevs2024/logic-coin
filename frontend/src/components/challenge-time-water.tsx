import {useEffect,useState} from 'react';
import {Animated,Platform,StyleSheet,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {useIsFocused} from 'expo-router';
import {useReducedMotion} from 'react-native-reanimated';
import {useAppTheme} from '@/hooks/use-app-theme';
import {challengeElapsed} from '@/lib/challenge-time';
import type {TodayChallenges} from '@/types';
export function ChallengeTimeWater({today}:{today?:TodayChallenges}){
 const theme=useAppTheme(),focused=useIsFocused(),reduced=useReducedMotion();const [now,setNow]=useState(Date.now);const [phase]=useState(()=>new Animated.Value(0));
 useEffect(()=>{if(!focused)return;const tick=()=>setNow(Date.now());const immediate=setTimeout(tick,0),timer=setInterval(tick,1000);return()=>{clearTimeout(immediate);clearInterval(timer);};},[focused]);
 useEffect(()=>{if(!focused||reduced)return;const loop=Animated.loop(Animated.timing(phase,{toValue:1,duration:6000,useNativeDriver:Platform.OS!=='web'}));loop.start();return()=>loop.stop();},[phase,focused,reduced]);
 const ratio=challengeElapsed(today?.startsAt,today?.endsAt,now);const color=String(theme.primary);const translucent=/^#[a-f\d]{6}$/i.test(color)?color+'22':'rgba(37,99,235,.12)';
 if(!today?.available||!today.endsAt)return null;
 return <View testID="challenge-time-water" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill,{overflow:'hidden',borderRadius:30}]}>
  <View testID="challenge-time-water-level" style={{position:'absolute',left:0,right:0,bottom:0,height:`${ratio*100}%`,backgroundColor:translucent}}>
   <Animated.View style={{position:'absolute',top:-14,left:0,width:'220%',height:28,transform:[{translateX:phase.interpolate({inputRange:[0,1],outputRange:[0,-120]})}]}}>
    <Svg width="100%" height="28" viewBox="0 0 1200 24" preserveAspectRatio="none"><Path d="M0 12 Q150 0 300 12 T600 12 T900 12 T1200 12 V24 H0Z" fill={translucent}/></Svg>
   </Animated.View>
  </View>
 </View>;
}
