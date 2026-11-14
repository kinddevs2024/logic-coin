import { afterEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { User } from "../src/models/User.js";
import { NotificationEvent } from "../src/models/NotificationEvent.js";
import { DailyContestResult } from "../src/models/DailyContestResult.js";
import { listInbox, countUnreadInbox } from "../src/services/inbox.service.js";
afterEach(()=>vi.restoreAllMocks());
it("excludes chat events and legacy conversation payloads from both system list and badge", async()=>{
  vi.spyOn(User,"findById").mockReturnValue({select:()=>({lean:async()=>({createdAt:new Date(0),preferences:{language:"ru"}})})} as never);
  vi.spyOn(DailyContestResult,"distinct").mockResolvedValue([]);
  const aggregate=vi.spyOn(NotificationEvent,"aggregate").mockResolvedValue([]);
  const id=new Types.ObjectId();
  await listInbox(id,true);await countUnreadInbox(id);
  for(const call of aggregate.mock.calls){
    const first=call[0]![0] as {$match:Record<string,unknown>};
    expect(first.$match.type).toEqual({$nin:["gift_received","chat_message"]});
    expect(first.$match["payload.conversationId"]).toEqual({$in:[null,""]});
    expect(first.$match.$or).toBeDefined();
  }
  expect(aggregate).toHaveBeenCalledTimes(2);
});
