import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-15",
  title: "Exported saves are about sixteen times smaller",
  items: [
    "Exported saves were far bigger than they needed to be. An eight-season save came out as an 84 MB file, which is big enough that you can't really send it to anyone. About half of that was blank space: I was writing the file with indentation to make it readable as text, and nothing ever reads it as text. Export Save now writes a compressed file instead, ending in .json.gz, and that same save comes out at 5.2 MB. A save is many thousands of records repeating the same field names, which is the shape compression handles best.",
    "Nothing is left out to get there. Compression is reversible, so what you import back is identical in every detail to what you exported, and I didn't prune any history to save space.",
    "Import the file exactly as it downloaded, without unzipping it first. Saves you exported from an older version are plain .json and still load fine, and roster files are uncompressed and unaffected.",
  ],
};

export default entry;
