import { expect, it } from "vitest";
import { mergeOutgoingMessages } from "../src/lib/chat-optimistic";
import type { ChatItem } from "../src/lib/chat-api";
const queued={clientId:"client-1",text:"hello",attachmentIds:[],queuedAt:1000};
it("uses one stable client key before and after acknowledgement",()=>{
 const pending=mergeOutgoingMessages([], [queued], "user", "attachment");
 expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({clientId:"client-1",pending:true,text:"hello"});
 const confirmed={...pending[0]!,id:"server-id",pending:false,seq:42} as ChatItem;
 const merged=mergeOutgoingMessages([confirmed],[queued],"user","attachment");
 expect(merged).toHaveLength(1);expect(merged[0]).toMatchObject({id:"server-id",clientId:"client-1",pending:false});
});
