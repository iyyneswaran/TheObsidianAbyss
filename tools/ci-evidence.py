"""Export only action names and timings from failed browser traces."""
import json
from pathlib import Path
from zipfile import ZipFile

out = Path("test-results/action-timings.json")
records = []
for archive in Path("test-results").rglob("trace.zip"):
    with ZipFile(archive) as trace:
        for filename in trace.namelist():
            if filename.endswith(".trace"):
                for line in trace.read(filename).splitlines():
                    item = json.loads(line)
                    if item.get("type") in ("before", "after"):
                        records.append({key: item[key] for key in
                                        ("type", "class", "method", "startTime", "endTime")
                                        if key in item})
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(records, indent=2), encoding="utf-8")
