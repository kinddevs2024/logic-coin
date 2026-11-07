import {afterEach,expect,it,vi} from "vitest";
const api=vi.hoisted(()=>({refresh:vi.fn()}));vi.mock("../src/lib/api",()=>({API_URL:"https://unit.test/api/v1",refreshAccessToken:api.refresh}));vi.mock("../src/lib/telegram-context",()=>({telegramChallengeInitData:()=>undefined}));
class Socket{static OPEN=1;readyState=1;onopen:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;onclose:((event:{code:number})=>void)|null=null;onerror:(()=>void)|null=null;static instances:Socket[]=[];constructor(){Socket.instances.push(this);}send=vi.fn();close(code=1000){this.readyState=3;this.onclose?.({code});}}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it("reconnects after an expired session when token refresh temporarily fails",async()=>{
 vi.useFakeTimers();vi.stubGlobal("WebSocket",Socket);api.refresh.mockRejectedValue(new Error("offline"));const {subscribeToChallengeUpdates}=await import("../src/lib/challenge-live-updates");const unsubscribe=subscribeToChallengeUpdates("transient-test-token",()=>{});const first=Socket.instances[0]!;first.onopen?.();first.onmessage?.({data:JSON.stringify({type:"authenticated"})});first.close(4401);await vi.advanceTimersByTimeAsync(1000);expect(api.refresh).toHaveBeenCalledWith("transient-test-token");expect(Socket.instances).toHaveLength(2);unsubscribe();
});
