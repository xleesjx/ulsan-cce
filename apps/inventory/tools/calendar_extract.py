#!/usr/bin/env python3
"""시설 이용현황 달력(구글 시트에서 받은 엑셀) → 날짜별 원문 글자 목록 (1단계).

달력은 한 장에 6개월 블록이 세로로 있고, 한 블록에 왼쪽 달(B~H열)·오른쪽 달(J~P열)이 나란히 있습니다.
날짜 숫자가 있는 줄 아래에서 다음 날짜 줄 전까지가 그 주의 칸 글자입니다.
합쳐진 칸(월~금 걸친 방학 일정 등)은 걸친 날짜마다 넣습니다.
"""
import json
import re
import sys
import warnings
from datetime import date, timedelta

import openpyxl

warnings.filterwarnings("ignore")

LEFT = list(range(2, 9))    # B..H
RIGHT = list(range(10, 17))  # J..P
DAYNAMES = ("일", "월요일", "화요일", "수요일", "목요일", "금요일", "토")


def num(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return int(v)
    return None


def extract(path, year=None):
    wb = openpyxl.load_workbook(path)
    ws = wb.worksheets[0]
    merged = {}
    for mr in ws.merged_cells.ranges:
        merged[(mr.min_row, mr.min_col)] = (mr.max_row, mr.max_col)

    # 달 머리줄 찾기: H열(8) 값이 연도, B열(2) 값이 달
    blocks = []
    for r in range(1, ws.max_row + 1):
        b, h, j, p = (ws.cell(r, c).value for c in (2, 8, 10, 16))
        if num(h) and num(h) > 2000 and num(b) and 1 <= num(b) <= 12:
            blocks.append((r, num(b), num(h), num(j), num(p)))
    if not year and blocks:
        year = blocks[0][2]

    out = {}   # 'YYYY-MM-DD' → [ {text, row, col, span} ]
    notes = []
    for bi, (hr, lm, ly, rm, ry) in enumerate(blocks):
        end = blocks[bi + 1][0] if bi + 1 < len(blocks) else ws.max_row + 1
        for side, cols, month, yr in (("L", LEFT, lm, ly), ("R", RIGHT, rm, ry)):
            if not month:
                continue
            # 이 달의 날짜 줄들 (요일 줄 다음부터)
            date_rows = []
            for r in range(hr + 1, end):
                vals = [ws.cell(r, c).value for c in cols]
                if any(v == "일" or (isinstance(v, str) and v.endswith("요일")) for v in vals):
                    continue
                nums = [(i, v) for i, v in enumerate(vals) if num(v) is not None or (isinstance(v, str) and re.fullmatch(r"\d{1,2}/\d{1,2}", v.strip()))]
                if nums and len(nums) >= 1 and all(1 <= (num(v) or 1) <= 31 for _, v in nums):
                    # 날짜 줄: 숫자가 2개 이상이거나 첫 주의 일부
                    if len(nums) >= 2 or (len(nums) == 1 and r - hr < 6):
                        date_rows.append(r)
            for k, dr in enumerate(date_rows):
                stop = date_rows[k + 1] if k + 1 < len(date_rows) else end
                for ci, c in enumerate(cols):
                    dv = ws.cell(dr, c).value
                    days = []
                    if num(dv) is not None:
                        days = [num(dv)]
                    elif isinstance(dv, str) and re.fullmatch(r"\d{1,2}/\d{1,2}", dv.strip()):
                        days = [int(x) for x in dv.strip().split("/")]
                        notes.append("%d-%02d: 한 칸에 날짜 두 개 (%s) — 첫 날짜에 넣었어요" % (yr, month, dv))
                    if not days:
                        continue
                    for r in range(dr + 1, stop):
                        v = ws.cell(r, c).value
                        if v is None or str(v).strip() == "":
                            continue
                        text = str(v).strip()
                        span_cols = [c]
                        if (r, c) in merged:
                            mr, mc = merged[(r, c)]
                            span_cols = list(range(c, mc + 1))
                        # 날짜별로 기록
                        for sc in span_cols:
                            sci = cols.index(sc) if sc in cols else None
                            if sci is None:
                                continue
                            dd = ws.cell(dr, sc).value
                            dnum = num(dd)
                            if dnum is None and isinstance(dd, str) and re.fullmatch(r"\d{1,2}/\d{1,2}", dd.strip()):
                                dnum = int(dd.strip().split("/")[0])
                            if dnum is None:
                                continue
                            try:
                                d = date(yr, month, dnum)
                            except ValueError:
                                notes.append("%d-%02d: 잘못된 날짜 %s" % (yr, month, dnum))
                                continue
                            out.setdefault(d.isoformat(), []).append({"text": text, "row": r, "col": c, "span": len(span_cols)})
    # 안내 글자(범례)는 빼기
    legend = {"사용실 사용자", "행사명 시간"}
    for k in list(out):
        out[k] = [e for e in out[k] if e["text"] not in legend]
        if not out[k]:
            del out[k]
    return out, notes


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    data, notes = extract(sys.argv[1])
    dst = sys.argv[2] if len(sys.argv) > 2 else "tools/work/calendar_raw.json"
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("날짜 %d일에 글자가 있어요 · 글자 칸 %d개" % (len(data), sum(len(v) for v in data.values())))
    for n in notes[:10]:
        print(" ·", n)
