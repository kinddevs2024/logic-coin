/** One in-flight, idempotent progress PUT. Local persisted state remains authoritative offline. */
export function createProgressSyncQueue<T>(save:(value:T)=>Promise<unknown>,delayMs=5000,retryMs=30000){
  let latest:{value:T;key:string}|null=null,savedKey:string|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined,running=false,disposed=false,lastStarted=-Infinity;
  const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
  const arm=(delay:number)=>{if(disposed||timer||running)return;timer=setTimeout(()=>{timer=undefined;void flush();},delay);};
  async function flush(){
    clear();if(disposed||running||!latest)return;
    if(latest.key===savedKey){latest=null;return;}
    const entry=latest;latest=null;running=true;lastStarted=Date.now();let failed=false;
    try{await save(entry.value);savedKey=entry.key;}catch{failed=true;latest??=entry;}
    finally{running=false;if(latest&&!disposed)arm(failed?retryMs:Math.max(0,delayMs-(Date.now()-lastStarted)));}
  }
  return {
    schedule(value:T){if(disposed)return;const key=JSON.stringify(value);latest={value,key};if(key===savedKey&&!running){latest=null;clear();return;}arm(Math.max(delayMs,delayMs-(Date.now()-lastStarted)));},
    markSynced(value:T){savedKey=JSON.stringify(value);},
    flush,
    dispose(){disposed=true;clear();latest=null;}
  };
}
