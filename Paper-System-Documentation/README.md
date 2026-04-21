# Paper System Documentation Bundle

This folder contains documentation artifacts prepared from the current Meringued website implementation:

- `01-Events-Table.md`
- `02-Use-Case-List.md`
- `03-Use-Case-Diagram.md`
- `04-Use-Case-Diagrams-Context.md` (textual companion to the UML figures; regenerated with `scripts/build_use_case_diagram_docx.py`)
- `05-Use-Case-Descriptions.md` (paragraph-style use case descriptions for each diagrammed module, SRS-style)

These files are intentionally separated from the application source folder so you can copy/adapt them into your paper.

## Word exports

- `01-Events-Table.docx` (generated from `01-Events-Table.md`)
- `02-Use-Case-Diagram.docx` (detailed UML-style figures: run `scripts/build_use_case_diagram_docx.py` after installing `requirements-paper.txt` into a venv; regenerates multiple `assets/use-case-*.svg` files)

### Regenerating the use case diagram Word file

From the repository root (or any path), using the project venv that has `python-docx` and `cairosvg`:

```bash
.docx-venv/bin/pip install -r Paper-System-Documentation/requirements-paper.txt
.docx-venv/bin/python Paper-System-Documentation/scripts/build_use_case_diagram_docx.py
```

That command refreshes all `assets/use-case-*.svg` files, rewrites **`04-Use-Case-Diagrams-Context.md`**, and rebuilds **`02-Use-Case-Diagram.docx`**. `03-Use-Case-Diagram.md` still holds the detailed Mermaid flowchart for editing.

