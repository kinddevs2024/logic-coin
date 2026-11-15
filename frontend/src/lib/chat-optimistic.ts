import type { ChatItem } from "./chat-api";
import type { OutgoingChatMessage } from "./chat-outbox";
export function mergeOutgoingMessages(messages: ChatItem[], queued: OutgoingChatMessage[], accountId: string, attachmentLabel: string): ChatItem[] {
  const existing = new Set(messages.filter(message => message.own && message.clientId).map(message => message.clientId));
  let seq = Math.max(0, ...messages.map(message => message.seq));
  const pending: ChatItem[] = queued.filter(item => !existing.has(item.clientId)).map(item => ({
    id: `pending:${item.clientId}`,clientId:item.clientId,pending:true,seq:++seq,
    sender:{id:accountId,name:""},text:item.text || attachmentLabel,createdAt:new Date(item.queuedAt).toISOString(),
    edited:false,deleted:false,pinned:false,forwardedFrom:null,reply:null,attachments:[],reactions:[],own:true,
  }));
  return [...messages,...pending];
}
