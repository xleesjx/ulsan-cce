#!/usr/bin/env python3
"""학교 이름 목록 → docs/schools.json (대여 등록 화면의 자동완성에 쓰입니다).

사용법:
    python3 tools/make_schools.py 학교목록.txt

학교목록.txt 는 한 줄에 학교 이름 하나입니다. (엑셀·CSV 파일이면 첫 번째 열을 학교 이름으로 읽습니다)
weekend-checker 구글 시트의 [설정_학교] 탭 첫 번째 열을 복사해 붙여 넣어도 됩니다.
학교가 새로 생기거나 없어지는 해에만 다시 만들어 올리면 됩니다.
"""
import csv
import json
import sys
from pathlib import Path

SKIP = {"학교명", "학교", "이름", "name"}


def main(src):
    names = []
    with open(src, encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f):
            if not row:
                continue
            n = row[0].strip()
            if n and n not in SKIP and n not in names:
                names.append(n)
    names.sort()
    dst = Path(__file__).resolve().parent.parent.parent.parent / "docs" / "inventory" / "schools.json"
    dst.write_text(json.dumps(names, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print("학교 %d곳을 %s 에 저장했습니다." % (len(names), dst))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
