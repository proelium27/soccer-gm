import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-30",
  title: "The AI roster prompt is harder to get wrong",
  items: [
    "**Copy AI Prompt to Customize** fills a prompt in with your world's league names and sizes, and I found two ways that quietly goes wrong. If a name in the file doesn't match one of your leagues, the importer drops that whole league and doesn't tell you. If a league lists more clubs than it has slots, the extras get cut off the end of your list. Either way the file imports without complaining and just doesn't do what you meant.",
    "So the prompt says all of that to the AI now. Copy the league name off the list instead of building one out of the country's name, because your English top flight is called \"English Division 1\" and not \"England Division 1\". Don't list more clubs than the slot count, and when the real league is bigger than the slot count, pick which clubs to leave out yourself rather than letting the end of your list get thrown away. And if you ask for a league your world hasn't got, say so instead of guessing a name for it.",
    "That last one matters more than it sounds. A division here can be anywhere from ten clubs to twenty now that they follow the real leagues, so \"about twenty\" isn't a safe guess any more.",
    "The prompt ends with a short checklist too, so there's one last pass over the league names and the club counts before you get the file.",
  ],
};

export default entry;
