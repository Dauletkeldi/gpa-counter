"""
MySdu scraper backend — runs locally at http://localhost:5001
Logs into my.sdu.edu.kz and returns transcript + attendance as JSON.
"""

import re
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["*"])   # allow localhost frontend and GitHub Pages

MYSDU_BASE   = "https://my.sdu.edu.kz"
LOGIN_URL    = f"{MYSDU_BASE}/loginAuth.php"
TRANSCRIPT_URL = f"{MYSDU_BASE}/index.php?mod=transkript"
ATTENDANCE_URL = f"{MYSDU_BASE}/index.php?mod=ejurnal"


# ── helpers ───────────────────────────────────────────────────────────────────

def _login(session: requests.Session, username: str, password: str) -> bool:
    """POST login form; return True if session is authenticated."""
    payload = {
        "username":  username,
        "password":  password,
        "modstring": "",
        "LogIn":     " Log in ",
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": f"{MYSDU_BASE}/index.php",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/124.0.0.0 Safari/537.36",
    }
    resp = session.post(LOGIN_URL, data=payload, headers=headers, allow_redirects=True, timeout=15)
    # If login fails MySdu redirects back to index with no PHPSESSID carrying user data
    # A successful login keeps us on a page that does NOT contain the login form
    return "loginAuth.php" not in resp.url and resp.status_code == 200


def _clean(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


# ── transcript scraper ────────────────────────────────────────────────────────

def scrape_transcript(session: requests.Session) -> list[dict]:
    """
    Returns a list of semester dicts:
    {
      "semester": "2023-2024 Fall",
      "sa": 120,        # semester academic hours/credits
      "ga": 120,        # cumulative
      "spa": 3.50,
      "gpa": 3.42,
      "courses": [
        { "code": "CS101", "title": "...", "credits": 5, "ects": 7.5,
          "grade": 85, "letter": "B+", "point": 3.33, "traditional": "Хорошо" }
      ]
    }
    """
    resp = session.get(TRANSCRIPT_URL, timeout=15)
    if resp.status_code != 200:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    semesters = []
    current_semester = None

    rows = soup.select("table tr")

    for row in rows:
        cells = row.find_all("td")
        if not cells:
            continue

        # Detect semester header rows — they typically have a single cell spanning columns
        # and contain year + season text like "2023-2024 - Осенний"
        if len(cells) == 1:
            text = _clean(cells[0].get_text())
            if re.search(r'\d{4}[-–]\d{4}', text):
                current_semester = {"semester": text, "courses": [],
                                    "sa": None, "ga": None, "spa": None, "gpa": None}
                semesters.append(current_semester)
            continue

        # Detect semester footer rows — maroon color rows with SPA/GPA totals
        style = row.get("style", "")
        if "Maroon" in style or "maroon" in style:
            if current_semester is None:
                continue
            texts = [_clean(c.get_text()) for c in cells]
            # Footer format: SA | GA | SPA | GPA  (positions vary, find by label)
            full_text = " ".join(texts)
            sa_m  = re.search(r'SA[:\s]+(\d+\.?\d*)', full_text)
            ga_m  = re.search(r'GA[:\s]+(\d+\.?\d*)', full_text)
            spa_m = re.search(r'SPA[:\s]+(\d+\.?\d*)', full_text)
            gpa_m = re.search(r'GPA[:\s]+(\d+\.?\d*)', full_text)
            if sa_m:  current_semester["sa"]  = float(sa_m.group(1))
            if ga_m:  current_semester["ga"]  = float(ga_m.group(1))
            if spa_m: current_semester["spa"] = float(spa_m.group(1))
            if gpa_m: current_semester["gpa"] = float(gpa_m.group(1))
            continue

        # Regular course rows — class "clsTd" or similar with ≥8 cells
        if current_semester is None or len(cells) < 7:
            continue

        texts = [_clean(c.get_text()) for c in cells]
        # Typical column order:
        # 0: № | 1: code | 2: title | 3: credits | 4: ECTS | 5: grade | 6: letter | 7: point | 8: traditional
        try:
            # Try to parse — skip header rows (non-numeric credits)
            code     = texts[1] if len(texts) > 1 else ""
            title    = texts[2] if len(texts) > 2 else ""
            credits  = float(texts[3]) if len(texts) > 3 and texts[3].replace('.','',1).isdigit() else None
            ects     = float(texts[4]) if len(texts) > 4 and texts[4].replace('.','',1).isdigit() else None
            grade    = float(texts[5]) if len(texts) > 5 and texts[5].replace('.','',1).isdigit() else None
            letter   = texts[6] if len(texts) > 6 else ""
            point    = float(texts[7]) if len(texts) > 7 and texts[7].replace('.','',1).isdigit() else None
            trad     = texts[8] if len(texts) > 8 else ""

            if credits is None or grade is None:
                continue  # skip header/label rows

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
    """
    Returns list of course attendance dicts:
    {
      "course": "Calculus",
      "total_hours": 45,
      "absences": 8,
      "absence_pct": 17.78
    }
    """
    resp = session.get(ATTENDANCE_URL, timeout=15)
    if resp.status_code != 200:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    courses = []
    rows = soup.select("table tr")

    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        texts = [_clean(c.get_text()) for c in cells]
        # Try to find rows with numeric attendance data
        try:
            # Look for pattern: course name | total | absences | pct
            # MySdu ejurnal typically: course | lec_absent | prac_absent | lab_absent | total_absent | total_hours | pct
            course_name = texts[0]
            if not course_name or course_name.lower() in ("", "дисциплина", "course", "пән"):
                continue

            # Find total hours and absence count — scan cells for numbers
            nums = []
            for t in texts[1:]:
                t_clean = t.replace('%', '').strip()
                try:
                    nums.append(float(t_clean))
                except ValueError:
                    nums.append(None)

            # Heuristic: last numeric-looking cell ending in % is absence_pct
            pct = None
            for t in reversed(texts):
                if '%' in t:
                    try:
                        pct = float(t.replace('%', '').strip())
                        break
                    except ValueError:
                        pass

            # Total hours and absences: find two consecutive integers
            total_hours = None
            absences = None
            valid_nums = [n for n in nums if n is not None]
            if len(valid_nums) >= 2:
                absences    = int(valid_nums[-2]) if pct is None else None
                total_hours = int(valid_nums[-1]) if pct is None else None

            if pct is None and total_hours and absences is not None:
                pct = round(absences / total_hours * 100, 2) if total_hours > 0 else 0

            if pct is None:
                continue

            courses.append({
                "course": course_name,
                "total_hours": total_hours,
                "absences": absences,
                "absence_pct": pct,
            })
        except (IndexError, ValueError):
            continue

    return courses


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.route("/api/mysdu", methods=["POST"])
def api_mysdu():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    if not _login(session, username, password):
        return jsonify({"error": "Login failed — check your credentials"}), 401

    transcript  = scrape_transcript(session)
    attendance  = scrape_attendance(session)

    return jsonify({
        "ok": True,
        "transcript": transcript,
        "attendance": attendance,
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("MySdu proxy running at http://localhost:5001")
    print("POST /api/mysdu  { username, password }")
    app.run(host="127.0.0.1", port=5001, debug=False)
