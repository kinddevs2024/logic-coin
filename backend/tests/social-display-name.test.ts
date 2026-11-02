import {expect,it} from "vitest";
import {socialDisplayName} from "../src/lib/social-display-name.js";
it("fits long provider names without cutting a surrogate pair",()=>{const name=socialDisplayName("A".repeat(79)+"😀".repeat(20));expect(name).toHaveLength(79);expect(socialDisplayName("😀".repeat(70))).toHaveLength(80);});
it("preserves normal names and supplies a fallback for blank provider names",()=>{expect(socialDisplayName("  Ali   Vali ")).toBe("Ali Vali");expect(socialDisplayName("   ")).toBe("Logic Coin user");expect(socialDisplayName(undefined,"Logic member")).toBe("Logic member");});
