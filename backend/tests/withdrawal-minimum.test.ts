import {beforeEach,describe,expect,it,vi} from "vitest";
import {Types} from "mongoose";
const mocks=vi.hoisted(()=>({findOne:vi.fn(),findUser:vi.fn()}));
vi.mock("../src/config/env.js",()=>({env:{MIN_WITHDRAWAL_CENTS:500,UNIT_VALUE_CENTS:1}}));
vi.mock("../src/models/Withdrawal.js",()=>({Withdrawal:{findOne:mocks.findOne}}));
vi.mock("../src/models/User.js",()=>({User:{findById:mocks.findUser}}));
import {createSandboxWithdrawal} from "../src/services/withdrawal.service.js";
describe("five-dollar withdrawal minimum",()=>{
 const input={userId:new Types.ObjectId(),idempotencyKey:"minimum-test-replay",card:{brand:"visa" as const,last4:"4242"},agreementVersion:"2026-08-23"};
 beforeEach(()=>{vi.clearAllMocks();mocks.findOne.mockResolvedValue({_id:new Types.ObjectId(),amountCents:500});mocks.findUser.mockReturnValue({select:vi.fn().mockResolvedValue({wallet:{availableUnits:500,lockedUnits:500,lifetimeEarnedUnits:1000}})});});
 it("rejects $4.99 before reading or changing any wallet",async()=>{
  await expect(createSandboxWithdrawal({...input,amountCents:499})).rejects.toMatchObject({code:"withdrawal_below_minimum",details:{minimumCents:500}});
  expect(mocks.findOne).not.toHaveBeenCalled();expect(mocks.findUser).not.toHaveBeenCalled();
 });
 it("accepts the $5 boundary and preserves idempotent replay",async()=>{
  const result=await createSandboxWithdrawal({...input,amountCents:500});expect(result.idempotentReplay).toBe(true);expect(mocks.findOne).toHaveBeenCalledOnce();
 });
});
