import { expect, it } from "vitest";
import { countdownMilestone, raffleEligible, youtubeVideoId } from "../src/lib/raffle-policy.js";
it("accepts HTTPS YouTube video URLs and rejects look-alike hosts and credentials",()=>{
 for(const u of ["https://youtube.com/watch?v=dQw4w9WgXcQ","https://youtu.be/dQw4w9WgXcQ","https://youtube.com/live/dQw4w9WgXcQ"])expect(youtubeVideoId(u)).toBe("dQw4w9WgXcQ");
 for(const u of ["https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ","javascript:alert(1)","http://youtube.com/watch?v=dQw4w9WgXcQ","https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ"])expect(youtubeVideoId(u)).toBeNull();
});
it("requires six distinct days in the window and recent presence",()=>{
 const days=["01","02","03","04","05","06","07"],now=new Date();
 expect(raffleEligible(days.slice(0,6),days,now,now)).toBe(true);
 expect(raffleEligible(["01","01","02","03","04","05"],days,now,now)).toBe(false);
 expect(raffleEligible(["00",...days.slice(0,5)],days,now,now)).toBe(false);
 expect(raffleEligible(days,days,new Date(now.getTime()-20001),now)).toBe(false);
});
it("notifies every ten seconds then each second in the last ten",()=>{
 const start=new Date();for(const s of [60,50,40,30,20,10,9,8,7,6,5,4,3,2,1])expect(countdownMilestone(start,new Date(+start-s*1000))).toBe(s);
 for(const s of [61,59,11,0,-1])expect(countdownMilestone(start,new Date(+start-s*1000))).toBeNull();
});
