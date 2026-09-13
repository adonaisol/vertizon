import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildExtractionPrompt } from "./prompt";
import { RubricSchema } from "./schema";

const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));

describe("buildExtractionPrompt", () => {
  const p = buildExtractionPrompt({ rubric, level: "L4", review: "She led the migration.", rating: 3 });
  it("includes only the employee's level bars", () => {
    expect(p.user).toContain("Owns and delivers scoped projects");
    expect(p.user).not.toContain("Leads cross-team projects");
  });
  it("includes the review and the manager's rating label", () => {
    expect(p.user).toContain("She led the migration.");
    expect(p.user).toContain("Exceeds");
  });
  it("instructs to judge the work, not the writing, and to prefer low sufficiency over guessing", () => {
    expect(p.system).toMatch(/not the quality of the writing/i);
    expect(p.system).toMatch(/sufficiency/i);
  });
  it("never mentions a manager name field", () => {
    expect(p.user).not.toMatch(/manager name/i);
  });
});
