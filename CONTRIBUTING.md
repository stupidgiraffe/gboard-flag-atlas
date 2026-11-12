# Contributing to Gboard Flag Atlas

Thanks for helping document Gboard's experimental features.

## Flag evidence is more useful than guesses

Open an issue or pull request containing:

- Exact identifier (copy/paste)
- Tested Gboard/GboardWu version and build
- Flag type and observed default, when known
- Before/after behavior and precise steps to reproduce
- Relevant screenshots or logs **with private data redacted**
- Whether behavior persists after restart and whether it varies by language/device

Use **Name-derived** when all you know is the identifier. Reserve **Interpreted** for explanations with additional evidence, and describe the evidence explicitly. Do not report defaults that you have not checked.

## Updating data

- Add or edit entries in `data/flags.json` without changing stable flag names.
- Keep `data/flag-identifiers.json` as the raw per-version extraction snapshot; do not insert invented identifiers.
- Avoid claims about battery impact unless measured. Distinguish idle drain from active-use CPU/GPU overhead.
- Do not include private APK assets, proprietary source, passwords, application secrets, typing histories or sensitive logs.

## Development

Open `index.html` through a simple local HTTP server (fetching a JSON file from `file://` may be blocked by browsers):

```sh
python3 -m http.server 8000
```

Then browse to http://localhost:8000 . No build tools or dependencies needed.

## Licensing

Contributions to the website code are MIT-licensed. Original text/data annotations are licensed under CC BY 4.0 as stated in DATA-LICENSE.md. Please only submit material you have the right to share.
