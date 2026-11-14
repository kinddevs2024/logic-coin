// Monotonic within the session, even if storage fails or an old response arrives.
export const seenHomeTours=new Set<string>();
export function shouldShowHomeTour(input:{local:string|null;cached?:boolean;remote?:boolean;guest:boolean}):boolean{
 if(input.local==='done'||input.cached===true||input.remote===true)return false;
 return input.guest||input.remote===false||input.cached===false;
}
