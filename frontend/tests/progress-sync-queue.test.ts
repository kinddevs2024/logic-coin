import {afterEach,expect,it,vi} from "vitest";
import {createProgressSyncQueue} from "../src/lib/progress-sync-queue";
afterEach(()=>vi.useRealTimers());
it("coalesces continuous changes and never overlaps progress writes",async()=>{
 vi.useFakeTimers();let release:()=>void=()=>{};const save=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>{release=r;})).mockResolvedValue(undefined);const q=createProgressSyncQueue(save);
 for(let i=0;i<5;i++){q.schedule({score:i});await vi.advanceTimersByTimeAsync(1000);}expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenLastCalledWith({score:4});q.schedule({score:20});await vi.advanceTimersByTimeAsync(10000);expect(save).toHaveBeenCalledTimes(1);release();await vi.advanceTimersByTimeAsync(0);expect(save).toHaveBeenCalledTimes(2);expect(save).toHaveBeenLastCalledWith({score:20});q.dispose();
});
it("skips unchanged progress and flushes the last change when backgrounded",async()=>{vi.useFakeTimers();const save=vi.fn().mockResolvedValue(undefined),q=createProgressSyncQueue(save);q.markSynced({score:1});q.schedule({score:1});await vi.advanceTimersByTimeAsync(6000);expect(save).not.toHaveBeenCalled();q.schedule({score:2});await q.flush();expect(save).toHaveBeenLastCalledWith({score:2});q.dispose();});
it("retains failed saves, retries with backoff and sends the latest state",async()=>{vi.useFakeTimers();const save=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined),q=createProgressSyncQueue(save);q.schedule({score:1});await vi.advanceTimersByTimeAsync(5000);q.schedule({score:2});await vi.advanceTimersByTimeAsync(29999);expect(save).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1);expect(save).toHaveBeenLastCalledWith({score:2});q.dispose();});
it("does not upload after account disposal",async()=>{vi.useFakeTimers();const save=vi.fn(),q=createProgressSyncQueue(save);q.schedule({score:2});q.dispose();await vi.advanceTimersByTimeAsync(60000);expect(save).not.toHaveBeenCalled();});
