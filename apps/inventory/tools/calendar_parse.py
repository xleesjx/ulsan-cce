#!/usr/bin/env python3
"""달력 원문(calendar_extract.py 결과) → 교실 예약 행 + 확인표 (2단계).

사용법:
    python3 tools/calendar_parse.py [--staff "이름,이름"] [calendar_raw.json]

만들어지는 것 (tools/work/ 폴더):
    교실예약_가져오기.csv   구글 시트 [교실예약] 탭에 가져오기 할 파일
    확인표_교실.csv         원문 · 해석 결과 · 확인할 이유 (사람이 훑어보는 표)
    확인표_교실.txt         요약과 선생님께 여쭈어볼 것들
"""
import csv
import json
import re
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOMS = ["SW교육체험교실", "라온실", "혜윰실", "창의실", "놀이실"]
ROOM_PAT = r"(?:SW\s*(?:교육\s*)?체험\s*(?:교육\s*)?(?:교실|실)|[혜헤]\s*[윰움]\s*실|라온\s*실|창의\s*실|놀이\s*실)"
ROOM_RE = re.compile(ROOM_PAT, re.I)
ROOM_START = re.compile(r"^(?:본원B동4층)?\s*(" + ROOM_PAT + r"(?:\s*[,/·]\s*" + ROOM_PAT + r")*)", re.I)
ROOM_END = re.compile(r"^(.+?)\s+(" + ROOM_PAT + r")\s*$", re.I)
HOLIDAYS = {"신정", "설날", "삼일절", "대체휴일", "어린이날", "부처님", "오신날", "지방선거", "현충일", "광복절", "추석", "개천절", "한글날", "성탄절", "설날연휴", "추석연휴"}
ORG_SUFFIX = ("과", "센터", "원", "팀", "청", "부", "교", "초", "중")
SURNAMES = set("김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구나민진지엄채원천방공현함변염추도소석선마길위표명기반왕금옥육인맹제모탁국어은편용예경봉사부가")
NOT_NAME = {"지원단", "협의회", "컨설팅", "설명회", "보고회", "특강", "면담", "점검", "연수원", "심의", "나눔회", "기초학", "교육과", "소독", "자문", "인사"}
TIME_RES = [
    (re.compile(r"(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})"), "hm-hm"),
    (re.compile(r"(\d{1,2})\s*시\s*[~\-]\s*(\d{1,2})\s*시"), "h-h"),
    (re.compile(r"(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*시"), "h-h"),
    (re.compile(r"(\d{1,2}):(\d{2})\s*~?"), "hm"),
    (re.compile(r"(\d{1,2})\s*시\s*~?"), "h"),
]


def hh(h):
    return "%02d" % h


def fix_hours(s, e):
    """'3시' → 15:00, '9시~6시' → 09~18 처럼 오후로 바로잡기"""
    if s < 8:
        s += 12
    if e is not None and e <= s:
        e += 12
    return s, e


def find_time(text):
    """글자 안에서 시간을 찾아 (시작, 끝, 시간 글자를 뺀 글자, 설명)를 돌려줌"""
    for rx, kind in TIME_RES:
        m = rx.search(text)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        note = ""
        if kind == "hm-hm":
            s, e = g[0] * 60 + g[1], g[2] * 60 + g[3]
        elif kind == "h-h":
            s0, e0 = g
            s, e = fix_hours(s0, e0)
            if (s0, e0) != (s, e):
                note = "시간 해석: %s → %s~%s" % (m.group(0).strip(), hh(s), hh(e))
            s, e = s * 60, e * 60
        elif kind == "hm":
            s, e = g[0] * 60 + g[1], None
        else:
            s0 = g[0]
            s, _ = fix_hours(s0, None)
            if s != s0:
                note = "시간 해석: %s → %s:00" % (m.group(0).strip(), hh(s))
            s, e = s * 60, None
        rest = (text[:m.start()] + " " + text[m.end():]).strip()
        st = "%02d:%02d" % (s // 60, s % 60)
        en = ("%02d:%02d" % (e // 60, e % 60)) if e is not None else ""
        return st, en, rest, note
    return None


def norm_room(s):
    s = s.replace(" ", "").lower()
    if s.startswith("sw"):
        return "SW교육체험교실"
    if s[0] in "혜헤":
        return "혜윰실"
    for r in ROOMS:
        if r.replace(" ", "") == s:
            return r
    return s


def rooms_in(s):
    out = []
    for m in ROOM_RE.finditer(s):
        r = norm_room(m.group(0))
        if r not in out:
            out.append(r)
    return out


ORG_WORDS = {"연수원", "교육청", "본청", "시교육청", "교육연수원"}


def is_org(tok):
    """학교·기관 이름인지. '이정원'(사람)과 '교육연수원'(기관)을 구분하려고 글자 수를 봅니다"""
    if tok in ORG_WORDS:
        return True
    if tok.endswith(("과", "센터", "초", "중", "교")):
        return len(tok) >= 3 and not re.fullmatch(r"[가-힣]{3}", tok[:-1] + "ㅇ") is None or len(tok) >= 3
    if tok.endswith(("원", "팀", "청", "부")):
        return len(tok) >= 4
    return False


def is_name(tok):
    return len(tok) == 3 and re.fullmatch(r"[가-힣]{3}", tok) is not None and tok[0] in SURNAMES and tok not in NOT_NAME and not is_org(tok)


def who_split(text):
    """'가나교육과, 홍길동' 같은 글자를 (소속들, 이름들)로. 해석 불가면 None"""
    toks = [t for t in re.split(r"[,\s/·]+", text.strip()) if t]
    if not toks or len(toks) > 5:
        return None
    orgs, names = [], []
    for t in toks:
        if is_name(t):
            names.append(t)
        elif is_org(t):
            orgs.append(t)
        else:
            return None
    return orgs, names


class Event:
    def __init__(self, date):
        self.date = date
        self.rooms, self.persons, self.orgs, self.purpose = [], [], [], []
        self.start = self.end = ""
        self.kind = ""
        self.raw = []
        self.flags = []
        self.special = False
        self.review = False

    def add_person(self, p):
        if p and p not in self.persons:
            self.persons.append(p)

    def add_org(self, o):
        if o and o not in self.orgs:
            self.orgs.append(o)

    def set_time(self, st, en, note=""):
        if self.start and (self.start, self.end) != (st, en):
            self.flags.append("시간이 두 번 나와요 (%s~%s / %s~%s)" % (self.start, self.end, st, en))
            return
        self.start, self.end = st, en
        if note:
            self.flags.append(note)


def parse_room_rest(ev, rest):
    """교실 이름 뒤에 붙은 글자(담당자·소속·괄호·시간)를 읽음"""
    rest = rest.strip(" ,/")
    for pm in re.finditer(r"\(([^)]*)\)", rest):
        inner = pm.group(1)
        t = find_time(inner)
        if t:
            ev.set_time(t[0], t[1], t[3])
            inner = t[2]
        w = who_split(inner) if inner.strip(" ,") else None
        if w:
            [ev.add_org(o) for o in w[0]]
            [ev.add_person(n) for n in w[1]]
        elif inner.strip(" ,"):
            ev.flags.append("괄호 안 글자 확인: (%s)" % inner)
    rest = re.sub(r"\([^)]*\)", " ", rest)
    t = find_time(rest)
    if t:
        ev.set_time(t[0], t[1], t[3])
        rest = t[2]
    rest = rest.strip(" ,/")
    if rest:
        w = who_split(rest)
        if w:
            [ev.add_org(o) for o in w[0]]
            [ev.add_person(n) for n in w[1]]
        else:
            ev.purpose.append(rest)


def parse_day(date, lines):
    events, cur, holiday = [], None, False

    def new(special=False):
        nonlocal cur
        cur = Event(date)
        cur.special = special
        events.append(cur)
        return cur

    for raw in lines:
        line = re.sub(r"\s+", " ", raw.replace("\n", " ")).strip()
        if not line:
            continue
        if line in HOLIDAYS:
            holiday = True
            continue
        if re.search(r"주말\s*창의\s*\d+\s*회", line):
            ev = new(True); ev.raw.append(raw); ev.kind = "센터 수업"; ev.purpose.append(re.sub(r"\s+", " ", line))
            continue
        if "소독" in line and "협의" not in line:
            ev = new(True); ev.raw.append(raw); ev.kind = "시설 관리"
            t = find_time(line)
            if t:
                ev.set_time(t[0], t[1], t[3]); line = t[2]
            ev.purpose.append(line.strip() or "소독")
            continue
        if "방학" in line and "전실" in line:
            ev = new(True); ev.raw.append(raw); ev.kind = "센터 수업"; ev.rooms = list(ROOMS); ev.start, ev.end = "09:00", "12:00"
            ev.purpose.append(re.sub(r"\(오전 전실사용\)", "", line).strip())
            continue

        m = ROOM_START.match(line)
        if m:
            rooms = rooms_in(m.group(1))
            rest = line[m.end():]
            rest_clean = re.sub(r"[\s,/·]+", "", rest)
            ft = find_time(rest)
            only_time = bool(ft) and not re.sub(r"[\s,/·()~\-]+", "", ft[2])
            if cur and not cur.rooms and not cur.special and (rest_clean == "" or only_time):
                cur.rooms = rooms; cur.raw.append(raw)
                if rest_clean:
                    parse_room_rest(cur, rest)
                continue
            ev = new(); ev.raw.append(raw); ev.rooms = rooms
            parse_room_rest(ev, rest)
            continue

        me = ROOM_END.match(line)
        if me and not find_time(line):
            ev = new(); ev.raw.append(raw); ev.rooms = rooms_in(me.group(2)); ev.purpose.append(me.group(1).strip())
            continue

        t = find_time(line)
        if t and not t[2].strip(" ()~,-"):
            if cur is None:
                new()
            cur.raw.append(raw)
            cur.set_time(t[0], t[1], t[3])
            continue
        if re.fullmatch(r"\(?\s*오전\s*\)?", line) or line.startswith("(오전)") or line.startswith("(오후)"):
            if cur is None or cur.start or (cur.purpose and not cur.special):
                new()
            cur.raw.append(raw)
            cur.start, cur.end = ("09:00", "12:00") if "오전" in line else ("13:00", "17:00")
            cur.flags.append("%s → %s~%s로 해석" % (line.split(")")[0] + ")", cur.start, cur.end))
            line = re.sub(r"^\((오전|오후)\)\s*", "", line)
            if not line:
                continue
        w = who_split(line)
        if w and (w[0] or w[1]):
            if cur is None:
                new()
            cur.raw.append(raw)
            [cur.add_org(o) for o in w[0]]
            [cur.add_person(n) for n in w[1]]
            continue

        # 일반 글자 = 행사 이름. 시간·괄호 속 시간은 떼어 냄
        if cur is None or (cur.purpose and cur.raw and False):
            new()
        text = line
        t = find_time(text)
        if t:
            if cur is None:
                new()
            cur.set_time(t[0], t[1], t[3])
            text = t[2].strip(" ()~,-")
        if "검토중" in text:
            text = re.sub(r"\(?검토중\)?", "", text).strip(" ()")
            cur.flags.append("(검토중)이라고 적혀 있었어요 → 확정으로 넣고 비고에 표시")
            cur.review = True
        parts = text.split()
        # 앞에 사람 이름이 붙은 행사 이름: '김은희 수업사례집협의회'
        if len(parts) >= 2 and is_name(parts[0]):
            cur.add_person(parts[0]); cur.flags.append("이름으로 추정: %s" % parts[0])
            parts = parts[1:]
            text = " ".join(parts)
        # 끝에 사람 이름이 붙은 행사 이름: '교원연수 홍길동'
        if len(parts) >= 2 and is_name(parts[-1]):
            cur.add_person(parts[-1]); cur.flags.append("이름으로 추정: %s" % parts[-1])
            text = " ".join(parts[:-1])
        cur.raw.append(raw)
        if text:
            cur.purpose.append(text)

    # 마무리: 비어 있는 행사 이름은 앞 행사의 것을 가져옴
    prev = None
    for ev in events:
        if not ev.purpose and prev and prev.purpose and not ev.special and not prev.special:
            ev.purpose = list(prev.purpose); ev.flags.append("행사 이름이 없어 위 행사의 이름을 가져왔어요")
            for p in prev.persons:
                if not ev.persons:
                    ev.persons = list(prev.persons)
        if not ev.special:
            prev = ev
    return events, holiday


def build(raw_json, staff):
    data = json.load(open(raw_json, encoding="utf-8"))
    rows, review = [], []
    all_events = []
    for date in sorted(data):
        lines = [e["text"] for e in data[date]]
        # '부처님'+'오신날' 처럼 쪼개진 휴일
        events, holiday = parse_day(date, lines)
        for ev in events:
            all_events.append(ev)
    return all_events


def decide_kind(ev, staff):
    if ev.kind:
        return ev.kind
    names = ev.persons
    if ev.orgs:
        return "외부 대여"
    if names and all(n in staff for n in names):
        return "내부 대여"
    if names:
        return "외부 대여" if staff else "확인 필요"
    return "내부 대여"  # 담당자·소속이 없는 일정은 센터 안의 일정으로 봅니다


def read_ledger(path):
    """따로 정리한 대장(구분자 |): 날짜|시간|소속|성명|신청공문|목적"""
    out = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        c = [x.strip() for x in line.split("|")]
        c += [""] * (6 - len(c))
        m = re.match(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})", c[0])
        if not m:
            continue
        d = "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3)))
        st = en = ""
        tm = re.match(r"(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})", c[1])
        if tm:
            st, en = "%02d:%s" % (int(tm.group(1)), tm.group(2)), "%02d:%s" % (int(tm.group(3)), tm.group(4))
        out.append(dict(date=d, start=st, end=en, org=c[2], name=c[3], docno=c[4], purpose=c[5]))
    return out


def apply_ledger(events, ledger):
    used = set()
    for ev in events:
        ev.docno = getattr(ev, "docno", "")
        if ev.kind != "외부 대여":
            continue
        for i, L in enumerate(ledger):
            if L["date"] != ev.date or L["name"] not in ev.persons:
                continue
            used.add(i)
            if L["org"]:
                ev.orgs = [L["org"]]  # 장부의 소속이 더 정확합니다
            if L["docno"]:
                ev.docno = L["docno"]
            if L["start"] and not ev.start:
                ev.start, ev.end = L["start"], L["end"]
                ev.flags.append("장부에서 시간 채움")
            if L["purpose"]:
                ev.purpose = [L["purpose"]]
            break
    return [L for i, L in enumerate(ledger) if i not in used]


def main():
    args = sys.argv[1:]
    ledger = []
    if "--ledger" in args:
        i = args.index("--ledger")
        ledger = read_ledger(args[i + 1])
        del args[i:i + 2]
    staff = set()
    if "--staff" in args:
        i = args.index("--staff")
        staff = {s.strip() for s in args[i + 1].split(",") if s.strip()}
        del args[i:i + 2]
    src = args[0] if args else "tools/work/calendar_raw.json"
    out = Path(src).parent
    events = build(src, staff)
    for ev in events:
        ev.kind = decide_kind(ev, staff)
    unmatched = apply_ledger(events, ledger) if ledger else []
    today_s = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")

    HEAD = ["예약번호", "교실", "종류", "날짜", "시작", "끝", "사용목적", "담당자", "소속", "휴대전화", "사무실전화", "공문확인", "공문번호", "비고", "상태", "등록자", "등록시각"]
    now = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")
    rows, review = [], []
    seq = 0
    kinds = Counter()
    for ev in events:
        ev.kind = decide_kind(ev, staff)
        purpose = " / ".join(dict.fromkeys(ev.purpose)).strip()
        rooms = ev.rooms or [""]
        flags = list(ev.flags)
        if not ev.rooms and not ev.special:
            flags.append("교실 이름이 없어요 → 교실 없이 일정만 넣음")
        if ev.kind == "확인 필요":
            flags.append("내부(센터 직원)인지 외부인지 알 수 없어요")
        if ev.kind in ("외부 대여", "내부 대여") and not ev.rooms:
            flags.append("대여인데 교실이 없어요")
        if ev.kind in ("외부 대여", "내부 대여") and not ev.start:
            flags.append("시간이 없어서 종일로 넣음")
        if not ev.persons and ev.kind in ("외부 대여", "내부 대여"):
            flags.append("담당자 이름이 없어요")
        for rm in rooms:
            seq += 1
            vid = "V-%s-%03d" % (ev.date[:4], seq)
            kind = ev.kind if ev.kind != "확인 필요" else "외부 대여"
            note_raw = " / ".join(re.sub(r"\s+", " ", r) for r in ev.raw)
            if kind == "외부 대여":
                docok = "Y" if (ev.docno or ev.date < today_s) else ""
            else:
                docok = "Y"
            note = (("검토중이었음. " if ev.review else "") + "엑셀 달력에서 옮김: " + note_raw)[:280]
            row = [vid, rm, kind, ev.date, ev.start, ev.end, purpose, ", ".join(ev.persons) if kind in ("외부 대여", "내부 대여") else "",
                   ", ".join(ev.orgs) if kind == "외부 대여" else "", "", "", docok, ev.docno if kind == "외부 대여" else "", note, "확정", "엑셀 이전", now]
            rows.append(row)
            kinds[kind] += 1
            review.append([vid, ev.date, note_raw, rm or "(교실 없음)", kind, (ev.start + ("~" + ev.end if ev.end else "")) or "종일", purpose,
                           ", ".join(ev.persons), ", ".join(ev.orgs), " · ".join(flags)])

    with open(out / "교실예약_가져오기.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(HEAD); w.writerows(rows)
    with open(out / "확인표_교실.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["예약번호", "날짜", "달력 원문", "교실", "종류", "시간", "사용목적", "담당자", "소속", "확인할 점"]); w.writerows(review)

    flagged = [r for r in review if r[9]]
    persons = Counter(p for ev in events for p in ev.persons)
    lines = ["# 교실 달력 옮기기 확인표", "", "예약 행 %d개 (행사 %d건)" % (len(rows), len(events)), "종류별: " + ", ".join("%s %d" % (k, v) for k, v in kinds.items()), "확인할 점이 있는 행: %d개" % len(flagged), ""]
    lines += ["## 등장하는 담당자 (내부/외부 구분용)"] + ["%s: %d건" % (k, v) for k, v in persons.most_common()]
    pending = [r for r in rows if r[2] == "외부 대여" and not r[11]]
    lines += ["", "## 앞으로 일정인데 공문번호가 없는 외부 대여 (앱에서 '공문 접수 확인' 알림으로 뜹니다): %d행" % len(pending)]
    lines += ["%s %s %s %s" % (r[3], r[1], r[6][:20], r[7]) for r in pending]
    if ledger:
        lines += ["", "## 장부에는 있는데 달력에서 찾지 못한 줄: %d" % len(unmatched)] + ["%s %s %s" % (u["date"], u["name"], u["purpose"][:20]) for u in unmatched]
    lines += ["", "## 확인할 점 모음"]
    reasons = Counter()
    for r in flagged:
        for x in r[9].split(" · "):
            reasons[x[:18]] += 1
    lines += ["%s: %d건" % (k, v) for k, v in reasons.most_common()]
    (out / "확인표_교실.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:60]))


if __name__ == "__main__":
    main()
