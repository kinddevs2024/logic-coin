import {describe,it,expect} from "vitest";
import {randomBytes} from "node:crypto";
import {encryptPayoutCard,decryptPayoutCard,validPayoutCard} from "../src/lib/payout-card.js";
describe("payout card encryption",()=>{
 const key=randomBytes(32),pan="4242424242424242",context="user-1:request-1";
 it("encrypts with random authenticated ciphertext and binds the recipient",()=>{const a=encryptPayoutCard(pan,context,key),b=encryptPayoutCard(pan,context,key);expect(a).not.toContain(pan);expect(a).not.toBe(b);expect(decryptPayoutCard(a,context,key)).toBe(pan);expect(()=>decryptPayoutCard(a,"another-user",key)).toThrow();expect(()=>decryptPayoutCard(a,context,randomBytes(32))).toThrow();});
 it("rejects damaged ciphertext",()=>{const a=encryptPayoutCard(pan,context,key).split('.');a[3]='AAAA';expect(()=>decryptPayoutCard(a.join('.'),context,key)).toThrow();});
 it.each(["1234","4242424242424241","4242 4242 4242 4242","not-a-card"])("rejects invalid card %s",v=>{expect(validPayoutCard(v)).toBe(false);expect(()=>encryptPayoutCard(v,context,key)).toThrow();});
});
