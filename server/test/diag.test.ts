import { describe, expect, it } from "vitest";
import { cleanClientDiag } from "../src/diag";

describe("끊김 기록", () => {
  it("알려진 칸만 받고 엉뚱한 값은 버린다", () => {
    const d = cleanClientDiag({ code: 1006, hidden: true, net: "x".repeat(50), evil: "<script>", rttMs: "NaN", afterSec: 3.6 });
    expect(d).toMatchObject({ code: 1006, hidden: true, net: "x".repeat(12), rttMs: null, afterSec: 4 });
    expect(d).not.toHaveProperty("evil");
    expect(cleanClientDiag(null).code).toBeNull();
  });
});
