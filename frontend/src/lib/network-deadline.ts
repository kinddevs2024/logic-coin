export class NetworkTimeoutError extends Error { constructor(){super("Network request timed out");this.name="NetworkTimeoutError";} }
export async function withNetworkDeadline<T>(run:(signal:AbortSignal)=>Promise<T>,external?:AbortSignal|null,milliseconds=20000):Promise<T>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  let cancel:(()=>void)|undefined;
  const stopped=new Promise<never>((_,reject)=>{
    cancel=()=>{controller.abort();const error=new Error("Request aborted");error.name="AbortError";reject(error);};
    if(external?.aborted){cancel();return;}
    external?.addEventListener("abort",cancel,{once:true});
    timer=setTimeout(()=>{controller.abort();reject(new NetworkTimeoutError());},milliseconds);
  });
  try{return await Promise.race([stopped,Promise.resolve().then(()=>{if(controller.signal.aborted){const error=new Error("Request aborted");error.name="AbortError";throw error;}return run(controller.signal);})]);}
  finally{if(timer)clearTimeout(timer);if(cancel)external?.removeEventListener("abort",cancel);}
}
