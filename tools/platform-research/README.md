# Platform research (not deployed)

How `tools/sources/platforms.json` was made:

1. `st2page.json` maps each station id to its English Wikipedia article; `th_titles.json` maps those to the Thai articles (via langlinks).
2. Rendered pages are fetched with the MediaWiki API (`action=parse`) into `html/` (English) and `thhtml/` (Thai). `fetchth.mjs` does the Thai ones, slowly, to respect rate limits.
3. `node combine.mjs "<project folder>" --write` reads the "Platform N | <line> towards X (next station)" rows (and the Thai "ชานชาลา N | มุ่งหน้า X (ถัดไป)" rows), and keeps a row only when:
   - its next station is a neighbour on our network (or, with no next station given, its "towards" picks exactly one direction),
   - its "towards" station lies ahead in that direction (after "via", if given),
   - it is not closed, under construction, or limited to certain hours or trains.
   Stations where English and Thai disagree are left out, and so are stations that a source says change platforms by time of day.
4. `node tools/build-data.mjs` merges the result into `data/transit.json`, and `node tests/run.mjs` checks it.

Every station in `platforms.json` lists the exact article revisions it came from.
