import { describe, expect, it } from "vitest";
import { turnout } from "./turnout";

describe("turnout", () => {
  it("compares the people present with the court's max", () => {
    expect(turnout(0, 12)).toBe("under");
    expect(turnout(11, 12)).toBe("under");
    expect(turnout(12, 12)).toBe("full");
    expect(turnout(13, 12)).toBe("over");
  });

  it("has no tone when the court has no max", () => {
    expect(turnout(5, null)).toBeNull();
  });
});
