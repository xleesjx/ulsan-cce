#!/usr/bin/env python3
"""교구목록 엑셀 → 새 물품 대장(구글 시트용 CSV) + 줄인 사진.

사용법:
    python3 tools/import_items.py "교구목록표.xlsx"

만들어지는 것 (tools/work/ 폴더):
    물품_가져오기.csv   구글 시트의 [물품] 탭에 가져오기 할 파일
    photos/             관리번호로 이름 붙인 작은 사진 (docs/photos/ 에 올립니다)
    확인표_물품.txt     옮기면서 확인이 필요한 것들
"""
import csv
import io
import re
import sys
import warnings
from collections import Counter
from pathlib import Path

import openpyxl
from PIL import Image

warnings.filterwarnings("ignore")

HEADER = ["관리번호", "분류", "품명", "사진", "설명", "대상학년", "영역", "구입연도", "보유수량",
          "보관위치", "세부위치", "상태", "외부공개", "호응", "과거활용기록", "비고", "부족기준"]
PREFIX = {"창의교구": "C", "SW교구": "S", "SW교재": "T", "기본준비물": "P", "비품·장비": "E"}
ROOMS = {"창의": "창의실", "자료": "자료실", "놀이": "놀이실", "혜윰": "혜윰실", "라온": "라온실",
         "창의실": "창의실", "놀이실": "놀이실", "혜윰실": "혜윰실", "라온실": "라온실", "자료실": "자료실", "4층": "4층"}
PHOTO_MAX = 400  # 긴 변 최대 픽셀

# 탭 이름 → (분류, 맨 윗 데이터 줄, 열 번호(1부터))
TABS = {
    "창의교구(사진)": dict(cat="창의교구", first=3, name=2, grade=3, photo=4, desc=5, year=6, qty=7, loc=8, area=9, used=10, like=11, note=12),
    "SW교구(사진)": dict(cat="SW교구", first=3, name=2, photo=3, desc=4, year=5, qty=6, loc=7, area=8, note=9),
    "SW교재": dict(cat="SW교재", first=3, name=2, photo=3, desc=4, year=5, qty=6, loc=7, area=8),
    "기본준비물": dict(cat="기본준비물", first=6, name=2, loc=3, note=4),
    "폐기파손교구(사진)": dict(cat=None, first=3, name=2, grade=3, photo=4, desc=5, year=6, qty=7, loc=8, area=9, used=10, like=11, note=12, discard=True),
}


def clean(v):
    """칸 안의 글자를 한 줄로 정리"""
    if v is None:
        return ""
    s = str(v).replace("\r", "")
    s = re.sub(r"\s*\n\s*", " ", s).strip()
    return re.sub(r"[ \t]{2,}", " ", s)


def multi(v):
    """여러 줄 칸(구입연도·활용횟수)은 쉼표로 이어 붙임"""
    if v is None:
        return ""
    return ", ".join(p.strip() for p in str(v).replace("\r", "").split("\n") if p.strip())


def find_sheet(wb, title):
    for ws in wb.worksheets:
        if ws.title.strip() == title:
            return ws
    return None


def photos_by_row(ws):
    """줄 번호(1부터) → 사진 바이트 목록"""
    out = {}
    for img in getattr(ws, "_images", []):
        try:
            row = img.anchor._from.row + 1
            out.setdefault(row, []).append(img._data())
        except Exception:
            continue
    return out


def assign_photos(ws, spec, pics):
    """사진을 물품 줄에 연결: 같은 줄 사진 먼저, 남은 사진은 바로 위·아래 빈 줄에만 붙임"""
    named = {r for r in range(spec["first"], ws.max_row + 1) if clean(ws.cell(r, spec["name"]).value) not in ("", "합계", "총계", "소계", "계")}
    assigned, leftovers = {}, []
    for p in sorted(pics):
        for i, data in enumerate(pics[p]):
            if i == 0 and p in named and p not in assigned:
                assigned[p] = data
            else:
                leftovers.append((p, data))
    unplaced = []
    for p, data in leftovers:
        for dr in (1, -1):
            q = p + dr
            if q in named and q not in assigned:
                assigned[q] = data
                break
        else:
            unplaced.append(p)
    return assigned, unplaced


def save_photo(data, path):
    im = Image.open(io.BytesIO(data))
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    k = min(1.0, PHOTO_MAX / max(im.size))
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(path, "JPEG", quality=72, optimize=True)


def norm_grade(v):
    s = clean(v)
    return {"전": "전체", "": ""}.get(s, s)


def norm_loc(v):
    """보관위치(실) / 세부위치로 나눔. 알 수 없는 표기는 그대로 두고 확인표에 올림"""
    s = clean(v)
    if not s:
        return "", "", False
    if s in ROOMS:
        return ROOMS[s], "", False
    toks = s.split()
    if toks and toks[0] in ROOMS:
        return ROOMS[toks[0]], " ".join(toks[1:]), False
    return s, "", True


def to_int(v):
    try:
        return int(float(str(v).strip()))
    except Exception:
        return None


def main(src, out_dir):
    out = Path(out_dir)
    (out / "photos").mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(src)
    rows, notes = [], []
    counter = Counter()
    photo_made = no_photo = 0
    loc_issues, qty_issues, missing_list = [], [], []

    def new_id(cat):
        counter[cat] += 1
        return "%s-%03d" % (PREFIX[cat], counter[cat])

    # 폐기 탭은 마지막에 (활용 중인 물품 번호를 먼저 매긴 뒤 이어서 번호)
    order = ["창의교구(사진)", "SW교구(사진)", "SW교재", "기본준비물", "폐기파손교구(사진)"]
    for title in order:
        ws = find_sheet(wb, title)
        spec = TABS[title]
        if ws is None:
            notes.append("탭을 찾지 못했습니다: " + title)
            continue
        pics = photos_by_row(ws)
        assigned, unplaced = assign_photos(ws, spec, pics) if "photo" in spec else ({}, [])
        n_tab = 0
        tab_photo = tab_missing = 0
        for r in range(spec["first"], ws.max_row + 1):
            g = lambda k: ws.cell(r, spec[k]).value if k in spec else None
            name = clean(g("name"))
            if not name or name in ("합계", "총계", "소계", "계"):
                continue  # 맨 아래 합계 줄은 물품이 아닙니다
            discard = spec.get("discard", False)
            area = clean(g("area"))
            cat = spec["cat"] or ("SW교구" if area == "SW" else "창의교구")
            iid = new_id(cat)
            loc, sub, odd = norm_loc(g("loc"))
            if odd:
                loc_issues.append("%s %s · 위치 '%s' → 그대로 두었어요" % (iid, name, loc))
            qty = to_int(g("qty"))
            note = clean(g("note")) if "note" in spec else ""
            if cat == "기본준비물":
                qty = 0
                note = (note + " / " if note else "") + "수량 확인 필요 (첫 점검 때 입력)"
            elif qty is None:
                qty_issues.append("%s %s · 보유수량이 비어 있어 0으로 넣었어요" % (iid, name))
                qty = 0
            status = "사용"
            if discard:
                status = "폐기"
            photo_file = ""
            if "photo" in spec:
                data = assigned.get(r)
                if data:
                    try:
                        save_photo(data, out / "photos" / (iid + ".jpg"))
                        photo_file = iid + ".jpg"
                        photo_made += 1
                        tab_photo += 1
                    except Exception as e:
                        notes.append("%s %s · 사진 변환 실패: %s" % (iid, name, e))
                        no_photo += 1
                        tab_missing += 1
                else:
                    no_photo += 1
                    tab_missing += 1
                    missing_list.append("%s %s (%s %d번째 줄)" % (iid, name, title, r))
            used = multi(g("used")) if "used" in spec else ""
            rows.append([
                iid, cat, name, photo_file, clean(g("desc")) if "desc" in spec else "", norm_grade(g("grade")) if "grade" in spec else "",
                area, multi(g("year")) if "year" in spec else "", qty, loc, sub, status, "", clean(g("like")) if "like" in spec else "",
                used, note, "",
            ])
            n_tab += 1
        n_pics = sum(len(v) for v in pics.values())
        notes.append("%s: %d줄 · 엑셀 속 사진 %d장 · 연결 %d · 사진 없는 물품 %d" % (title, n_tab, n_pics, tab_photo, tab_missing))
        if unplaced:
            notes.append("  · 어느 물품인지 알 수 없어 버린 사진: %d장 (줄 %s)" % (len(unplaced), ", ".join(map(str, unplaced[:10]))))

    with open(out / "물품_가져오기.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)

    cnt = Counter(r[1] for r in rows)
    report = ["# 물품 옮기기 확인표", "", "## 개수"]
    report += ["%s: %d개" % (k, cnt[k]) for k in PREFIX if cnt[k]]
    report += ["폐기 상태: %d개" % sum(1 for r in rows if r[11] == "폐기"), "사진 연결: %d장 / 사진 없음: %d개" % (photo_made, no_photo), ""]
    report += ["## 탭별 결과"] + notes + [""]
    report += ["## 확인이 필요한 위치 표기 (%d)" % len(loc_issues)] + loc_issues[:80] + [""]
    report += ["## 확인이 필요한 수량 (%d)" % len(qty_issues)] + qty_issues[:80] + [""]
    report += ["## 사진이 없는 물품 (%d) — 사진을 따로 넣어야 해요" % len(missing_list)] + missing_list[:100]
    report += ["", "## 위치별 개수"] + ["%s: %d" % (k or "(비어 있음)", v) for k, v in Counter(r[9] for r in rows).most_common()]
    (out / "확인표_물품.txt").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report[:30]))
    print("\n만든 곳:", out.resolve())


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else str(Path(__file__).parent / "work"))
