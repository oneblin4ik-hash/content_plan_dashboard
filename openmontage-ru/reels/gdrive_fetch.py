#!/usr/bin/env python3
"""Скачать файл из Google Drive, открытый по ссылке.

Большие файлы Drive отдаёт не сразу, а через страницу «не удалось проверить
на вирусы». Скрипт вынимает из неё токен подтверждения и качает сам файл
потоком — 700 МБ исходника не проходят через память.

Коннектор Drive для видео не годится: он возвращает содержимое файла
base64-строкой прямо в контекст.

    python gdrive_fetch.py <id-или-ссылка> [-o файл]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import requests

CHUNK = 1 << 20


def extract_id(value: str) -> str:
    """Принимает голый id, ссылку вида /file/d/<id>/ или ...?id=<id>."""
    for pattern in (r"/file/d/([A-Za-z0-9_-]{10,})", r"[?&]id=([A-Za-z0-9_-]{10,})"):
        match = re.search(pattern, value)
        if match:
            return match.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{10,}", value):
        return value
    raise SystemExit(f"не нашёл id файла Drive в: {value}")


def filename_from(response: requests.Response, fallback: str) -> str:
    disposition = response.headers.get("content-disposition", "")
    match = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", disposition)
    return match.group(1) if match else fallback


def fetch(file_id: str, out: Path | None) -> Path:
    session = requests.Session()
    url = "https://drive.usercontent.google.com/download"
    params = {"id": file_id, "export": "download", "confirm": "t"}

    response = session.get(url, params=params, stream=True, timeout=120)
    if response.status_code in (401, 403, 404):
        raise SystemExit(
            f"Drive ответил {response.status_code} для {file_id}: либо id неверный, "
            "либо файл не открыт по ссылке (нужен хотя бы «читатель»).")
    response.raise_for_status()

    if "text/html" in response.headers.get("content-type", ""):
        body = response.text
        token = None
        for pattern in (r'name="confirm"\s+value="([^"]+)"', r"confirm=([0-9A-Za-z_-]+)"):
            match = re.search(pattern, body)
            if match:
                token = match.group(1)
                break
        if token is None:
            snippet = re.sub(r"\s+", " ", body[:300])
            raise SystemExit(f"Drive вернул страницу вместо файла — проверьте доступ по ссылке. {snippet}")
        params["confirm"] = token
        uuid = re.search(r'name="uuid"\s+value="([^"]+)"', body)
        if uuid:
            params["uuid"] = uuid.group(1)
        response = session.get(url, params=params, stream=True, timeout=120)
        response.raise_for_status()
        if "text/html" in response.headers.get("content-type", ""):
            raise SystemExit("Drive продолжает отдавать страницу — проверьте доступ по ссылке.")

    target = out or Path(filename_from(response, f"{file_id}.bin"))
    total = 0
    with target.open("wb") as handle:
        for block in response.iter_content(CHUNK):
            handle.write(block)
            total += len(block)
    print(f"{target}  ({total / 1e6:.1f} МБ)")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", help="id файла или ссылка")
    parser.add_argument("-o", "--output", type=Path)
    args = parser.parse_args()
    fetch(extract_id(args.source), args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
