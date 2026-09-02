import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-02",
  title: "Job offers stopped arriving if you were doing well",
  items: [
    "Someone reported sitting on 100 reputation with nothing on the table, from a club or a country, and they were right. This one was properly backwards: the better you did, the fewer offers you got, until they stopped altogether.",
    "The game worked out a band of clubs your reputation said you deserved, and separately refused to offer you anything smaller than the club you already ran. Those are two different measuring sticks, and once you'd climbed high enough they stopped overlapping. Reputation tops out at 100, so the band tops out with it, and there's always one club in the world sitting above where the band can reach. Manage that club and nothing ever qualifies.",
    "It had a second victim I hadn't thought about: start a save at a big club with no CV at all and the same thing happened, because the band was sitting way below the club you'd been handed. No offers, however many titles you won, until your reputation caught up.",
    "Now your current club sets the floor and your reputation sets how far above it you can reach. Run a small club with nothing behind you and you'll hear from clubs at roughly your own level. Win things and the biggest jobs in the world start ringing. And if you're already at the top, you get approaches from your peers instead: fewer of them, all from clubs in the same bracket, which is about right.",
    "National teams had the identical bug and got the identical fix. Worth repeating that your international reputation is tracked separately from your club one, so a cabinet full of league titles doesn't get you the Brazil job.",
    "The same reasoning now applies when you're sacked. Getting let go drops you a rung *from where you were* rather than a rung from your reputation, so being dismissed by a giant no longer offers you the bottom of the pyramid.",
    "Nothing else about your save changes. No results move, no players move, just the offer list. If you've been sat there wondering why nobody wanted you, check the Manager page after your next season.",
  ],
};

export default entry;
