"""
MySdu scraper backend — runs locally at http://localhost:5001
Logs into my.sdu.edu.kz and returns transcript + attendance as JSON.
Supports 2FA (OTP via email).
"""

import re
import uuid
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["*"])

MYSDU_BASE     = "https://my.sdu.edu.kz"
LOGIN_URL      = f"{MYSDU_BASE}/loginAuth.php"
TRANSCRIPT_URL = f"{MYSDU_BASE}/index.php?mod=transkript"
ATTENDANCE_URL = f"{MYSDU_BASE}/index.php?mod=ejurnal"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0.0.0 Safari/537.36")

# In-memory store for sessions awaiting 2FA  { token: {"session": ..., "otp_url": ..., "otp_fields": ...} }
_pending: dict = {}


# ── helpers ───────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def _is_2fa_page(html: str) -> bool:
    """Detect if MySdu is showing a 2FA / OTP form."""
    lower = html.lower()
    return any(k in lower for k in ["otp", "one-time", "verification code",
                                     "код подтверждения", "растау коды",
                                     "tfa", "2fa", "two-factor", "two factor"])


def _extract_otp_form(html: str, base_url: str) -> tuple[str, dict]:
    """Return (form_action_url, hidden_fields_dict) from the OTP page."""
    soup = BeautifulSoup(html, "html.parser")
    form = soup.find("form")
    action = base_url
    hidden = {}
    if form:
        action_attr = form.get("action", "")
        if action_attr.startswith("http"):
            action = action_attr
        elif action_attr:
            action = MYSDU_BASE + "/" + action_attr.lstrip("/")
        # Collect all hidden inputs (CSRF tokens etc.)
        for inp in form.find_all("input", type="hidden"):
            name = inp.get("name")
            val  = inp.get("value", "")
            if name:
                hidden[name] = val
    return action, hidden


def _login_step1(username: str, password: str) -> tuple[requests.Session, str, str]:
    """
    POST login form.
    Returns (session, status, detail) where status is:
      "ok"    — fully logged in, no 2FA
      "2fa"   — 2FA page detected, detail = pending token
      "fail"  — wrong credentials
    """
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    payload = {
        "username":  username,
        "password":  password,
        "modstring": "",
        "LogIn":     " Log in ",
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": f"{MYSDU_BASE}/index.php",
    }
    resp = session.post(LOGIN_URL, data=payload, headers=headers,
                        allow_redirects=True, timeout=15)

    if resp.status_code != 200:
        return session, "fail", "HTTP error"

    html = resp.text

    # Check for 2FA
    if _is_2fa_page(html):
        otp_url, hidden = _extract_otp_form(html, resp.url)
        token = str(uuid.uuid4())
        _pending[token] = {
            "session":    session,
            "otp_url":    otp_url,
            "otp_hidden": hidden,
        }
        return session, "2fa", token

    # Check that we're not back on the login form
    if "loginAuth.php" in resp.url or "LogIn" in html[:2000]:
        return session, "fail", "Bad credentials"

    return session, "ok", ""


def _login_step2(token: str, otp: str) -> tuple[requests.Session | None, str]:
    """
    Submit the OTP. Returns (session, "ok") or (None, error_message).
    """
    pending = _pending.pop(token, None)
    if pending is None:
        return None, "Session expired or invalid token — please start over"

    session: requests.Session = pending["session"]
    otp_url: str              = pending["otp_url"]
    hidden: dict              = pending["otp_hidden"]

    # Build OTP payload — try common field names
    payload = dict(hidden)
    for field_name in ("otp", "code", "otp_code", "verification_code", "token", "tfa_code"):
        payload[field_name] = otp

    resp = session.post(otp_url, data=payload,
                        headers={"Content-Type": "application/x-www-form-urlencoded",
                                 "Referer": otp_url},
                        allow_redirects=True, timeout=15)

    html = resp.text
    if _is_2fa_page(html):
        return None, "OTP incorrect or expired — check your email and try again"

    if resp.status_code != 200:
        return None, f"OTP submission failed (HTTP {resp.status_code})"

    return session, "ok"


# ── transcript scraper ────────────────────────────────────────────────────────

def scrape_transcript(session: requests.Session) -> list[dict]:
    resp = session.get(TRANSCRIPT_URL, timeout=15)
    if resp.status_code != 200:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    semesters = []
    current_semester = None

    # Target the main content div, not the entire page (avoids nav sidebar)
    content = soup.find("div", id="divModule") or soup

    for row in content.select("table tr"):
        cells = row.find_all("td")
        if not cells:
            continue

        # Semester header: single cell (colspan=8) containing "YYYY - YYYY. N"
        if len(cells) == 1:
            text = _clean(cells[0].get_text())
            # matches "2023 - 2024. 1" or "2023-2024. 1" etc.
            if re.search(r'\d{4}\s*[-–]\s*\d{4}', text):
                current_semester = {"semester": text.strip(), "courses": [],
                                    "sa": None, "ga": None, "spa": None, "gpa": None,
                                    "credits": None, "ects": None}
                semesters.append(current_semester)
            continue

        # Semester footer: maroon style with credits / ECTS / SA/GA/SPA/GPA
        style = row.get("style", "")
        if "Maroon" in style or "maroon" in style:
            if current_semester is None:
                continue
            texts_f = [_clean(c.get_text()) for c in cells]
            full_text = " ".join(texts_f)
            for key, pat in [("sa",  r'SA\s*:\s*(\d+\.?\d*)'),
                             ("ga",  r'GA\s*:\s*(\d+\.?\d*)'),
                             ("spa", r'SPA\s*:\s*(\d+\.?\d*)'),
                             ("gpa", r'GPA\s*:\s*(\d+\.?\d*)')]:
                m = re.search(pat, full_text)
                if m:
                    current_semester[key] = float(m.group(1))
            # cells[2] = internal credits, cells[3] = ECTS
            if len(cells) >= 4:
                try:
                    current_semester["credits"] = float(texts_f[2])
                except (ValueError, IndexError):
                    pass
                try:
                    current_semester["ects"] = float(texts_f[3])
                except (ValueError, IndexError):
                    pass
            continue

        # Course row: must have exactly 8 cells (code, title, credit, ects, grade, letter, point, traditional)
        if current_semester is None or len(cells) != 8:
            continue

        texts = [_clean(c.get_text()) for c in cells]
        try:
            def to_float(s):
                s = s.strip()
                try: return float(s)
                except: return None

            code     = texts[0]
            title    = texts[1]
            credits  = to_float(texts[2])
            ects     = to_float(texts[3])
            grade    = to_float(texts[4])
            letter   = texts[5]
            point    = to_float(texts[6])
            trad     = texts[7]

            # Skip header row and "In progress" rows (no grade)
            if credits is None or grade is None:
                continue
            # Skip obvious header row by checking code looks like a course code
            if not re.match(r'^[A-Z]{2,4}\s*\d{3}', code):
                continue

            current_semester["courses"].append({
                "code": code, "title": title, "credits": credits,
                "ects": ects, "grade": grade, "letter": letter,
                "point": point, "traditional": trad,
            })
        except (IndexError, ValueError):
            continue

    return semesters


# ── attendance scraper ────────────────────────────────────────────────────────

def scrape_attendance(session: requests.Session) -> list[dict]:
    resp = session.get(ATTENDANCE_URL, timeout=15)
    if resp.status_code != 200:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []

    # Target main content div to skip navigation sidebar
    content = soup.find("div", id="divModule") or soup

    # Nav keywords that should never appear as course names
    NAV_SKIP = {"home page", "sign out", "transcript", "grades list",
                "course schedule", "messages", "settings", "my profile",
                "academic operations", "information", "services", "profile"}

    for row in content.select("table tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        texts = [_clean(c.get_text()) for c in cells]
        course_name = texts[0].strip()

        # Skip empty, header, or navigation rows
        if not course_name:
            continue
        if course_name.lower() in ("дисциплина", "course", "пән", "discipline", "n", "№"):
            continue
        if any(nav in course_name.lower() for nav in NAV_SKIP):
            continue
        # Skip rows where first cell is a plain number (row index)
        if re.fullmatch(r'\d+', course_name):
            continue
        # Skip very long strings that are concatenated nav links
        if len(course_name) > 120:
            continue

        try:
            # Find absence % — last cell containing %
            pct = None
            total_hours = None
            absences = None

            for t in reversed(texts):
                if '%' in t:
                    try:
                        pct = float(t.replace('%', '').strip())
                        break
                    except ValueError:
                        pass

            if pct is None:
                continue

            # Try to grab total hours and absence count from numeric cells
            nums = []
            for t in texts[1:]:
                t2 = t.replace('%','').strip()
                try:
                    nums.append(int(float(t2)))
                except ValueError:
                    pass
            if len(nums) >= 2:
                absences    = nums[-2]
                total_hours = nums[-1]

            courses.append({
                "course": course_name,
                "total_hours": total_hours,
                "absences": absences,
                "absence_pct": round(pct, 2),
            })
        except (IndexError, ValueError):
            continue

    return courses


def _scrape_all(session: requests.Session) -> dict:
    return {
        "ok": True,
        "transcript": scrape_transcript(session),
        "attendance": scrape_attendance(session),
    }


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.route("/api/mysdu/login", methods=["POST"])
def api_login():
    body     = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400

    session, status, detail = _login_step1(username, password)

    if status == "fail":
        return jsonify({"error": "Login failed — check your credentials"}), 401

    if status == "2fa":
        return jsonify({"needs_otp": True, "token": detail}), 200

    # No 2FA — scrape immediately
    return jsonify(_scrape_all(session))


@app.route("/api/mysdu/verify", methods=["POST"])
def api_verify():
    body  = request.get_json(silent=True) or {}
    token = body.get("token", "").strip()
    otp   = body.get("otp", "").strip()

    if not token or not otp:
        return jsonify({"error": "token and otp required"}), 400

    session, result = _login_step2(token, otp)
    if session is None:
        return jsonify({"error": result}), 401

    return jsonify(_scrape_all(session))


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("MySdu proxy running at http://localhost:5001")
    print("Step 1: POST /api/mysdu/login   { username, password }")
    print("Step 2: POST /api/mysdu/verify  { token, otp }  (if 2FA required)")
    app.run(host="127.0.0.1", port=5001, debug=False)
