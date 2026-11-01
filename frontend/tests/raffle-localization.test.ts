import { expect, it, vi } from "vitest";
vi.mock("../src/lib/api",()=>({request:vi.fn()}));
import { raffleText } from "../src/lib/raffle";
it("selects the language requested by the player",()=>{
 const names={ru:"Наушники",uz:"Quloqchin",en:"Headphones"};
 expect(raffleText(names,"legacy","ru")).toBe("Наушники");expect(raffleText(names,"legacy","uz")).toBe("Quloqchin");expect(raffleText(names,"legacy","en")).toBe("Headphones");
});
it("keeps legacy and missing translation names visible",()=>{
 expect(raffleText(undefined,"Старое событие","uz")).toBe("Старое событие");expect(raffleText({en:" "},"Legacy prize","en")).toBe("Legacy prize");
});
