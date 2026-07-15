#!/usr/bin/env python3
"""Check URLs in data/sites.json and emit a Markdown/JSON report.

This script never edits the catalogue and exits successfully even when a site
is unreachable, because many legacy sites block automated checks.
"""
from __future__ import annotations
import json
import pathlib
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sites.json"
REPORT = ROOT / "link-report.json"
USER_AGENT = "Mozilla/5.0 (compatible; KojinTaxiLinkChecker/1.0; +GitHub-Actions)"


def check(url: str) -> tuple[str, int | None, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            code = response.getcode()
            return ("ok" if 200 <= code < 400 else "warning", code, str(response.geturl()))
    except urllib.error.HTTPError as exc:
        # 401/403 often means the public page blocks bots rather than being gone.
        status = "restricted" if exc.code in (401, 403, 429) else "error"
        return status, exc.code, str(exc.geturl())
    except Exception as exc:  # noqa: BLE001
        return "error", None, f"{type(exc).__name__}: {exc}"


def main() -> None:
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    results = []
    for index, site in enumerate(payload["sites"], start=1):
        status, code, detail = check(site["url"])
        results.append({
            "id": site["id"], "organization": site["organization"], "url": site["url"],
            "status": status, "httpStatus": code, "detail": detail,
        })
        print(f"[{index:02}/{len(payload['sites'])}] {status:10} {code or '-':>3} {site['organization']}")
        time.sleep(0.2)
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {status: sum(r["status"] == status for r in results) for status in ("ok", "restricted", "warning", "error")},
        "results": results,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n## 個人タクシー開業リンク集・リンク確認")
    print(f"- OK: {report['summary']['ok']}")
    print(f"- 自動確認制限: {report['summary']['restricted']}")
    print(f"- 要確認: {report['summary']['warning'] + report['summary']['error']}")


if __name__ == "__main__":
    main()
