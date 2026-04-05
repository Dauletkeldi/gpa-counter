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

    for row in soup.select("table tr"):
        cells = row.find_all("td")
        if not cells:
            continue

        if len(cells) == 1:
            text = _clean(cells[0].get_text())
            if re.search(r'\d{4}[-–]\d{4}', text):
                current_semester = {"semester": text, "courses": [],
                                    "sa": None, "ga": None, "spa": None, "gpa": None}
                semesters.append(current_semester)
            continue

        style = row.get("style", "")
        if "Maroon" in style or "maroon" in style:
            if current_semester is None:
                continue
            full_text = " ".join(_clean(c.get_text()) for c in cells)
            for key, pat in [("sa", r'SA[:\s]+(\d+\.?\d*)'),
                             ("ga", r'GA[:\s]+(\d+\.?\d*)'),
                             ("spa", r'SPA[:\s]+(\d+\.?\d*)'),
                             ("gpa", r'GPA[:\s]+(\d+\.?\d*)')]:
                m = re.search(pat, full_text)
                if m:
                    current_semester[key] = float(m.group(1))
            continue

        if current_semester is None or len(cells) < 7:
            continue

        texts = [_clean(c.get_text()) for c in cells]
        try:
            credits = float(texts[3]) if texts[3].replace('.','',1).isdigit() else None
            grade   = float(texts[5]) if texts[5].replace('.','',1).isdigit() else None
            if credits is None or grade is None:
                continue
            current_semester["courses"].append({
                "code": texts[1], "title": texts[2], "credits": credits,
                "ects": float(texts[4]) if texts[4].replace('.','',1).isdigit() else None,
                "grade": grade,
                "letter": texts[6] if len(texts) > 6 else "",
                "point": float(texts[7]) if len(texts) > 7 and texts[7].replace('.','',1).isdigit() else None,
                "traditional": texts[8] if len(texts) > 8 else "",
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

    for row in soup.select("table tr"):
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        texts = [_clean(c.get_text()) for c in cells]
        course_name = texts[0]
        if not course_name or course_name.lower() in ("", "дисциплина", "course", "пән"):
            continue
        try:
            pct = None
            for t in reversed(texts):
                if '%' in t:
                    try:
                        pct = float(t.replace('%', '').strip())
                        break
                    except ValueError:
                        pass

            if pct is None:
                continue

            courses.append({
                "course": course_name,
                "total_hours": None,
                "absences": None,
                "absence_pct": pct,
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
