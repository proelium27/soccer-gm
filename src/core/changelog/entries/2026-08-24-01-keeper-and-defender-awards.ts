import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-24",
  title: "Goalkeepers and defenders get their own awards",
  items: [
    "No goalkeeper has ever won a Ballon d'Or in this game and none ever would have. It's scored on goals, assists and match rating, and a save doesn't appear in any of those. Over eight test seasons its top ten came out 45% strikers, 30% attacking midfielders, 20% wingers and one full-back. No centre-back, no holding midfielder, no keeper, ever.",
    "I'd rather leave the Ballon d'Or alone than rig it into something it isn't. The real one has gone to a defender once in about sixty years, and the actual ceremony gets around that by handing out a separate keeper's trophy. So I've done the same: **Goalkeeper of the Year** and **Defender of the Year**, both on the World tab of the Awards page, each with a five-man shortlist and the winner's season broken down the way the Ballon d'Or's is.",
    "They're judged on the work the Ballon d'Or can't see:",
    [
      "- Keepers on saves, with goals conceded held against them.",
      "- Defenders on tackles, interceptions and goals conceded. Centre-backs and full-backs both, competing for the one award.",
      "- Both then carry the same worldwide extras on top: the league-strength correction, your Continental Cup run, your summer with your country, your league title, your domestic cup. A keeper at a big club who wins things still beats an equally good one who doesn't.",
    ].join("\n"),
    "It's the same scoring the World Team of the Year already picks its eleven with, and that's deliberate. The Goalkeeper of the Year is essentially always the keeper in that XI, rather than the two awards disagreeing about who the best keeper alive was. Across 16 test seasons they matched every time.",
    "Both count as honours everywhere honours are counted: a player's profile, a club's history, the Frivolities award boards, and the GOAT ranking. That last one is the real change. A great keeper's whole all-time case used to be a World XI slot and a Team of the Season slot, which is a lot of why the GOAT board reads like a list of forwards. It still leans that way and it should, since a striker can win the Ballon d'Or on top of everything a defender can win, but a keeper has a case now where he had almost none.",
    "The defender award has a flaw I haven't fixed. Tackles and interceptions are counts, and unlike match ratings they aren't adjusted for how strong your league is, so a defender under siege every week piles up more of both than an equally good one at a club that controls its games. The award drifts towards defenders with a lot of defending to do, and centre-backs win it far more often than full-backs. That's how the World Team of the Year has always chosen its back four, so it isn't new, but giving it a trophy makes it obvious. Fixing it means scoring defenders against each other instead of counting what they pile up, which would change the Team of the Season in every league too, so it gets its own change rather than riding along with this one.",
    "Seasons you've already played don't get these. Awards are written down when they're won and never recalculated, partly because rescoring an old season would judge it on whoever hasn't retired yet and could hand its Ballon d'Or to someone else. So an existing save picks these up from its next completed season onward.",
  ],
};

export default entry;
