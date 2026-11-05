import {describe,it,expect,vi,beforeEach} from "vitest";
const mocks=vi.hoisted(()=>({exists:vi.fn(),contact:vi.fn(),update:vi.fn()}));
vi.mock("../src/config/env.js",()=>({env:{TELEGRAM_REGISTRATION_REQUIREMENTS:true,TELEGRAM_BOT_TOKEN:"123456:TEST_TOKEN_FOR_OFFLINE_TESTS"}}));
vi.mock("../src/models/User.js",()=>({User:{exists:mocks.exists}}));
vi.mock("../src/models/TelegramContact.js",()=>({TelegramContact:{findOne:()=>({select:mocks.contact}),updateOne:mocks.update}}));
import {ownTelegramContact,verifyRegistrationMembership,assertTelegramRegistration,prepareTelegramRegistration} from "../src/services/telegram-registration.service.js";
beforeEach(()=>{vi.restoreAllMocks();mocks.exists.mockReset().mockResolvedValue(false);mocks.contact.mockReset().mockResolvedValue(null);mocks.update.mockReset().mockResolvedValue({});});
describe("registration contacts",()=>{
 it("accepts only the sender's own private Telegram contact",()=>{expect(ownTelegramContact({chat:{id:7,type:"private"},from:{id:7},contact:{user_id:7,phone_number:"+998 90 123 45 67"}})).toBe("+998901234567");expect(ownTelegramContact({chat:{id:7,type:"private"},from:{id:7},contact:{user_id:8,phone_number:"123456"}})).toBeNull();expect(ownTelegramContact({chat:{id:-7,type:"group"},from:{id:7},contact:{user_id:7,phone_number:"123456"}})).toBeNull();});
 it.each(["left","kicked"])("rejects %s membership",async status=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,result:{status}})}));expect(await verifyRegistrationMembership("7")).toBe(false);});
 it.each(["member","administrator","creator"])("accepts %s membership",async status=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,result:{status}})}));expect(await verifyRegistrationMembership("7")).toBe(true);});
 it("preserves existing accounts without contact or channel checks",async()=>{mocks.exists.mockResolvedValue(true);const fetch=vi.fn();vi.stubGlobal("fetch",fetch);expect(await prepareTelegramRegistration({id:"7",firstName:"Test"},"7","ru")).toBe(true);expect(fetch).not.toHaveBeenCalled();});
 it("does not create a new registration without a verified contact",async()=>{await expect(assertTelegramRegistration({id:"7",firstName:"Test"})).rejects.toMatchObject({code:"telegram_contact_required"});});
 it("does not bypass a Telegram API failure",async()=>{mocks.contact.mockResolvedValue({phoneNumber:"+998901234567",phoneVerifiedAt:new Date()});vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({ok:false})}));await expect(assertTelegramRegistration({id:"7",firstName:"Test"})).rejects.toMatchObject({code:"telegram_unavailable"});});
});
