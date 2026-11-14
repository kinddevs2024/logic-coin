export function challengeElapsed(startsAt:string|null|undefined,endsAt:string|null|undefined,now:number):number{
 const end=Date.parse(endsAt??''),explicit=Date.parse(startsAt??''),start=Number.isFinite(explicit)?explicit:end-86400000;
 if(!Number.isFinite(end)||!Number.isFinite(start)||end<=start||!Number.isFinite(now))return 0;
 return Math.max(0,Math.min(1,(now-start)/(end-start)));
}
