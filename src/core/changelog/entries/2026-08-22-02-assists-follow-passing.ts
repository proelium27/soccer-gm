import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-22",
  title: "Assists go to your passers now",
  items: [
    "The match engine didn't have a **passing** attribute at all. So when a goal went in and it came time to hand out the assist, the only creative attribute it had to pick with was **dribbling**. An assist was really a dribbling stat.",
    "That meant a playmaker's passing barely showed up in his assist count. Measured over a full simmed league season, a creative midfielder's passing was almost unrelated to how many assists he ended up with. His dribbling was what decided it.",
    "Passing is in the engine now, and the assist goes to whoever gets picked on it. Same season, same measurement: passing predicts assists about four times as strongly, and dribbling's hold on the number drops to almost nothing. If you signed a playmaker for his vision, the assist column reflects him now.",
    "How many assists get handed out hasn't changed. It's still roughly three goals in four, with the rest going down unassisted, and attacking midfielders and wingers still pick up the most while defenders get the fewest. What moved is who gets credited.",
    "Assists feed into match ratings, and match ratings are part of how the coach decides who to substitute. So handing the assist to a different player occasionally changes a sub, and a sub occasionally changes a scoreline. Results from here will differ slightly from what the same save would have produced before. That's expected rather than a bug.",
  ],
};

export default entry;
