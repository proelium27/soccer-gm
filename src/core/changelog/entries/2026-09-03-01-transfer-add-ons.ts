import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-03",
  title: "Sell-on clauses and bonuses",
  items: [
    "Every deal you negotiate now has an **Add-ons** panel under the offer buttons, on both the Transfers page and Incoming Offers.",
    "A **sell-on share**, up to 40%. Sell a player with one attached and you keep that share of the **profit** if his new club moves him on again within 5 seasons. Profit is the word that matters: if they sell him for less than they paid you, you get nothing.",
    "And **bonuses**, paid once each if the thing happens within 3 seasons while he's still at that club. He plays 25 league games in a season, he scores 10 league goals in a season, his new club qualifies for Europe, his new club wins promotion. All four together can't come to more than half the cash fee.",
    "**Add-ons are not extra money.** The other club has a number in its head for the whole deal, and everything you put into add-ons comes straight off the cash. Ask for a 30% sell-on and today's cheque gets smaller by whatever they reckon that share is worth. The panel shows you the new cash figure before you commit, so you can see what you're giving up.",
    "I built it that way on purpose. The version where you keep the full fee and get a sell-on on top is just free money, and you'd take it on every deal without thinking. This way it's a decision. Take the cash if you need it now, or if you think he's already as good as he's getting. Take the sell-on if you're selling a 19-year-old to a superclub and you back your read on him over theirs.",
    "It works the other way round too, which I think is the more useful half. Buying someone you can't quite afford, you can offer the appearance bonus and pay less today. That's how a lot of real transfers get done.",
    "A sell-on fires whenever the club that owes it sells him, including years later to a third club you've never dealt with. Everything you're owed and everything you owe is listed under **Transfer Add-ons** on the Finance page, and on the player's own page. Rows drop off those lists the moment they pay, run out of time, or he leaves the club that owed them. A bonus dies unpaid if he's sold before it triggers, and a sell-on settles and ends the moment he's sold on.",
    "Getting the price right took measuring rather than guessing, and my first guess was bad. I built a tool that replays 24,000 real transfers and asks what a sell-on would have been priced at against what it would actually have paid. My first version charged you nearly **twice** what the clause was worth, because it assumed players get resold at a profit and mostly they don't: only **40%** of resales are for more than the club paid. The appearance bonus was priced at better than even money against a real **39.5%**, and the goal bonus at seven times its true rate. All of that is corrected. A bonus you'd never sensibly take is worse than no bonus at all.",
    "One limit worth knowing: this is yours only. AI clubs don't put add-ons on each other's deals yet. Letting them would change how money moves between every league in the world, which needs a lot more testing than letting you do it does.",
    "Existing saves are fine. There were no clauses before, so there's nothing to convert, and nothing about how the rest of the world trades has changed.",
  ],
};

export default entry;
