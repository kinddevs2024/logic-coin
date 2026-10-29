import { View } from 'react-native';
const spots = [
  { top: 620, height: 180, left: 0, width: 565 },
  { top: 908, height: 245, left: 0, width: 565 },
  { top: 175, height: 415, left: 0, width: 415 },
  { top: 400, height: 210, left: 425, width: 140 },
  { top: 0, height: 110, left: 0, width: 360 },
];
export function TutorialMask({ step }: { step: number }) {
  const spot = spots[step]!;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: 565, height: 1190 }}>
    {[
      { top: 0, left: 0, width: 565, height: spot.top },
      { top: spot.top + spot.height, left: 0, width: 565, height: 1190 - spot.top - spot.height },
      { top: spot.top, left: 0, width: spot.left, height: spot.height },
      { top: spot.top, left: spot.left + spot.width, width: 565 - spot.left - spot.width, height: spot.height },
    ].map((rect, index) => <View key={index} style={{ position: 'absolute', ...rect, backgroundColor: 'rgba(0,0,0,0.94)' }} />)}
  </View>;
}
