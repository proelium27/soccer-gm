import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-18",
  title: "Players you loaned out were coming back on dead contracts",
  items: [
    "Someone told me he'd loaned a player out and never got him back. The player turned up in Incoming Talent instead, unsigned, as if he'd never been his. He was right, and it wasn't a one-off.",
    "A loan doesn't touch the contract. He goes to the other club, plays there, and comes home on the same deal he left with. But the offseason released expired contracts **before** it processed loan returns, and while he's on loan he's sitting on the other club's roster, not yours. So the release found him there and dropped him off it, which left him on nobody's roster at all. He couldn't play, and you couldn't re-sign him either, because the game still thought he was away on loan. Then the loan ended and he was handed back to you on a contract that had already run out.",
    "I audited six saves people sent me. Every one of them had players in this state: **between 71 and 281 each**, some on contracts that had expired **six seasons** earlier. All of them were loan returns, with no exceptions. They're why you'd see a player stuck on a permanent \"Final year\" badge, valued at nothing, who no club would ever bid for.",
    "There was a second half to it. The club **borrowing** your player was the one deciding whether to renew him. Your own club got no say, and since he doesn't appear on your Roster page while he's away, you had no way to extend him yourself. He'd run his deal down at somebody else's club and leave for free the moment he got home.",
    "Four things changed. Loan returns are now processed before contracts expire, so he lands back with you first and his deal is settled there. A contract can no longer expire out from under a player mid-loan. **A loan can't be agreed for longer than his contract covers**, so the duration list only offers the seasons his deal runs, and a player in his last year can go out for one season rather than three. And the club that owns a player is the one that decides his contract, not the club borrowing him.",
    "For your own players, the Players Out on Loan list at the bottom of the Loans page now shows when each contract expires and lets you extend him from there. That's the only place you can, since he isn't on your Roster page while he's gone.",
    "One thing to know if you're carrying an affected save: players already sitting on dead contracts get sorted out at your next offseason, and sorted out means released. If one of them is someone you want, extend him before you advance.",
  ],
};

export default entry;
