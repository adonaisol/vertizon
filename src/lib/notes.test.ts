import { describe, it, expect } from "vitest";
import { flagsSelfContradiction } from "./notes";

describe("flagsSelfContradiction", () => {
  it("returns true for a note saying 'The review contradicts itself'", () => {
    const notes = ["The review contradicts itself: the manager rates this as Exceeds but the evidence shows at-bar behavior."];
    expect(flagsSelfContradiction(notes)).toBe(true);
  });

  it("returns false for a note about the manager's rating being contradicted by the text", () => {
    const notes = ["The manager's Exceeds rating is contradicted by the text."];
    expect(flagsSelfContradiction(notes)).toBe(false);
  });
});
