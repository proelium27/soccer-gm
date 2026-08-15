import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-20",
  title: "Stopped the free-agent flip, and made free agents harder to grab",
  items: [
    "Someone on Reddit pointed out you could sign a free agent for nothing and then immediately sell him for a big transfer fee, which is a pretty broken way to print money. So now when you sign a free agent onto your senior team, you're committed to him for a season before you can sell him. No club will bid on him until then, and the Roster page tells you he's not sellable yet instead of showing the List for Transfer button. You can still release him for free whenever you want, you just can't cash him in right away.",
    "While I was at it I made the free-agent pool worse to shop. The AI clubs now pick through it before you do, and they'll grab any genuinely useful free agent to upgrade a spot they've already got covered, not just to plug a hole. So by the time you get to the Free Agents page, most of the good ones are already gone and what's left is mostly squad filler. You'll still stumble on the odd bargain, but don't count on it.",
  ],
};

export default entry;
