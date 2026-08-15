import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-15",
  title: "Exported saves are about sixteen times smaller",
  items: [
    "Export Save now writes a compressed file, ending in .json.gz instead of .json. Measured on an eight-season save, the file falls from 84 MB to 5.2 MB. Two things account for it: the file no longer carries the indentation whitespace that made it readable as text, which was about half of it, and what remains is compressed. A save is many thousands of records repeating the same field names, which compresses unusually well.",
    "Nothing is dropped to achieve this. Compression is fully reversible, so an imported save is identical in every detail to the one exported. The file should be imported exactly as it downloaded, without unzipping it first.",
    "Import accepts both forms, so saves exported by earlier versions still load, as do roster files, which are uncompressed.",
  ],
};

export default entry;
