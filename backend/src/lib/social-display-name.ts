/** Provider names must fit the same UTF-16 limit as the user schema. */
export function socialDisplayName(value:string|undefined,fallback="Logic Coin user"):string {
  const text=value?.replace(/\s+/gu," ").trim()||fallback;
  let result="";
  for(const character of text){if(result.length+character.length>80)break;result+=character;}
  return result||fallback;
}
