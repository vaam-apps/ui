import { expect, test } from "@playwright/test";
import { STORY } from "./story-ids";

/**
 * The cheapest test here, and the one that makes every other failure
 * legible: a story id that no longer exists renders Storybook's error
 * page, on which a geometry selector times out with no hint as to why.
 * This turns that into one line naming the dead id.
 */
test("every story id this suite drives still exists in the built Storybook", async ({
  request,
}) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as { entries: Record<string, { type: string }> };
  const missing = Object.entries(STORY)
    .filter(([, id]) => index.entries[id]?.type !== "story")
    .map(([key, id]) => `${key} -> ${id}`);
  expect(missing, "story ids that no longer resolve to a story").toEqual([]);
});
