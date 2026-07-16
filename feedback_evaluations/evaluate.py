#!/usr/bin/env python3
"""Feedback evaluation summary generator.

Reads question.json + feedbacks.csv, computes stats per question type,
adds TAM analysis, and outputs a single self-contained summary.html.

Usage: python evaluate.py
"""

import csv
import json
import math
import statistics
from collections import Counter
from pathlib import Path

DIR = Path(__file__).parent


def load_questions():
    with open(DIR / "question.json", encoding="utf-8") as f:
        return json.load(f)


def load_feedbacks():
    rows = []
    with open(DIR / "feedbacks_20260711.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(json.loads(row["responses"]))
    return rows


def load_feedbacks_with_uid():
    """Return list of (user_id, responses_dict, group_size)."""
    rows = []
    with open(DIR / "feedbacks_20260711.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append((row["user_id"], json.loads(row["responses"]), int(row["group_size"])))
    return rows


def dedup_by_user(rows_with_uid):
    """Keep last entry per user_id. Returns list of (response_dict, group_size)."""
    seen = {}
    for uid, resp, gs in rows_with_uid:
        seen[uid] = (resp, gs)  # last wins
    return list(seen.values())


def stats_rating(values):
    """Return dict with min, max, mean, median, mode, stdev, count per score."""
    counts = Counter(values)
    return {
        "n": len(values),
        "min": min(values),
        "max": max(values),
        "mean": round(statistics.mean(values), 2),
        "median": statistics.median(values),
        "mode": statistics.mode(values),
        "stdev": round(statistics.stdev(values), 2) if len(values) > 1 else 0,
        "counts": {s: counts.get(s, 0) for s in range(1, 6)},
    }


def stats_select(values):
    """Return list of (option, count, pct)."""
    counts = Counter(values)
    total = len(values)
    return [
        (opt, counts.get(opt, 0), round(counts.get(opt, 0) / total * 100, 1))
        for opt in sorted(counts.keys(), key=lambda x: -counts[x])
    ]


def stats_text(values):
    """Return unique non-empty strings."""
    return sorted(set(v.strip() for v in values if v.strip()))


def rating_table(s):
    rows_html = ""
    for score in range(1, 6):
        c = s["counts"][score]
        pct = round(c / s["n"] * 100, 1) if s["n"] else 0
        bar = f'<div style="background:var(--accent);height:18px;width:{pct}%;border-radius:4px"></div>'
        rows_html += f"<tr><td>{score}</td><td>{c}</td><td>{pct}%</td><td>{bar}</td></tr>\n"
    return f"""<table class="stats">
<tr><th>Score</th><th>Count</th><th>%</th><th>Distribution</th></tr>
{rows_html}
<tr class="summary"><td colspan="4">
n={s['n']} &middot; Mean={s['mean']} &middot; Median={s['median']} &middot; Mode={s['mode']} &middot; SD={s['stdev']} &middot; Min={s['min']} &middot; Max={s['max']}
</td></tr></table>"""


def select_table(options):
    rows = ""
    for opt, cnt, pct in options:
        bar = f'<div style="background:var(--accent);height:18px;width:{pct}%;border-radius:4px"></div>'
        rows += f"<tr><td>{opt}</td><td>{cnt}</td><td>{pct}%</td><td>{bar}</td></tr>\n"
    return f'<table class="stats"><tr><th>Option</th><th>Count</th><th>%</th><th></th></tr>\n{rows}</table>'


def text_list(items):
    if not items:
        return '<p class="empty">No responses</p>'
    lis = "".join(f"<li>{item}</li>" for item in items)
    return f'<ul class="text-list">{lis}</ul>'


# ── TAM helpers (stdlib only) ──────────────────────────────────────────


def pearson_r(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return round(cov / (sx * sy), 4) if sx and sy else 0.0


def ols_simple(xs, ys):
    """Simple OLS: ys = b0 + b1*xs. Returns (b0, b1, r2, t_stat, p_value)."""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    ss_xx = sum((x - mx) ** 2 for x in xs)
    ss_yy = sum((y - my) ** 2 for y in ys)
    ss_xy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b1 = ss_xy / ss_xx if ss_xx else 0
    b0 = my - b1 * mx
    ss_res = sum((y - (b0 + b1 * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_yy if ss_yy else 0
    # t-test for slope
    if ss_xx and n > 2:
        se = math.sqrt(ss_res / (n - 2) / ss_xx)
        t = b1 / se if se else 0
        # approximate p from t distribution (two-tailed) using beta regularized
        df = n - 2
        p = _t_to_p(abs(t), df)
    else:
        t, p = 0.0, 1.0
    return round(b0, 4), round(b1, 4), round(r2, 4), round(t, 4), round(p, 4)


def _t_to_p(t, df):
    """Two-tailed p-value from t-stat using incomplete beta function approx."""
    x = df / (df + t * t)
    # regularized incomplete beta via continued fraction (stdlib only)
    return round(_beta_cdf(x, df / 2, 0.5) if x < 1 else 1.0, 4)


def _beta_cdf(x, a, b):
    """Regularized incomplete beta I_x(a,b) via continued fraction."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    # use Lentz's continued fraction
    lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
    front = math.exp(a * math.log(x) + b * math.log(1 - x) - lbeta) / a
    f, c, d = 1.0, 1.0, 0.0
    for i in range(200):
        m = i // 2 + 1
        if i == 0:
            num = 1.0
        elif i % 2 == 0:
            num = m * (b - m) * x / ((a + 2 * m - 2) * (a + 2 * m - 1))
        else:
            num = -(a + m - 1) * (a + b + m - 1) * x / ((a + 2 * m - 2) * (a + 2 * m - 1))
        d = 1.0 + num * d
        if abs(d) < 1e-30:
            d = 1e-30
        d = 1.0 / d
        c = 1.0 + num / c
        if abs(c) < 1e-30:
            c = 1e-30
        f *= c * d
        if abs(c * d - 1) < 1e-8:
            break
    return front * (f - 1.0)


def ols_multi(xss, ys):
    """Multiple OLS with intercept using normal equations. Returns (coeffs, r2)."""
    n = len(ys)
    k = len(xss)
    # design matrix with intercept
    X = [[1.0] + [xss[j][i] for j in range(k)] for i in range(n)]
    Y = ys
    # X^T X
    p = k + 1
    xtx = [[sum(X[i][r] * X[i][c] for i in range(n)) for c in range(p)] for r in range(p)]
    xty = [sum(X[i][r] * Y[i] for i in range(n)) for r in range(p)]
    # solve via Gaussian elimination
    coeffs = _gauss_solve(xtx, xty)
    yhat = [sum(coeffs[j] * X[i][j] for j in range(p)) for i in range(n)]
    ybar = sum(Y) / n
    ss_tot = sum((y - ybar) ** 2 for y in Y)
    ss_res = sum((Y[i] - yhat[i]) ** 2 for i in range(n))
    r2 = round(1 - ss_res / ss_tot, 4) if ss_tot else 0
    return [round(c, 4) for c in coeffs], r2


def _gauss_solve(A, b):
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        mx = col
        for row in range(col + 1, n):
            if abs(M[row][col]) > abs(M[mx][col]):
                mx = row
        M[col], M[mx] = M[mx], M[col]
        if abs(M[col][col]) < 1e-12:
            continue
        for row in range(col + 1, n):
            f = M[row][col] / M[col][col]
            for j in range(col, n + 1):
                M[row][j] -= f * M[col][j]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (M[i][n] - sum(M[i][j] * x[j] for j in range(i + 1, n))) / M[i][i]
    return x


def build_tam_html(deduped):
    """Build TAM analysis HTML section."""
    peou_ids = ["q20", "q21", "q22", "q23"]
    pu_ids = ["q24", "q25", "q26", "q27"]
    bi_id = "q29"

    def avg_items(resp, ids):
        vals = [int(resp[i]) for i in ids if i in resp and str(resp[i]).isdigit()]
        return round(sum(vals) / len(vals), 2) if vals else None

    peou_scores = []
    pu_scores = []
    bi_scores = []
    for resp in deduped:
        p = avg_items(resp, peou_ids)
        u = avg_items(resp, pu_ids)
        b = int(resp[bi_id]) if bi_id in resp and str(resp[bi_id]).isdigit() else None
        if p is not None and u is not None and b is not None:
            peou_scores.append(p)
            pu_scores.append(u)
            bi_scores.append(b)

    n = len(peou_scores)
    if n < 3:
        return '<div class="card"><p class="empty">Not enough complete responses for TAM analysis</p></div>'

    # Composite score stats
    def desc_stats(vals):
        return {
            "n": len(vals),
            "mean": round(statistics.mean(vals), 2),
            "median": round(statistics.median(vals), 2),
            "stdev": round(statistics.stdev(vals), 2) if len(vals) > 1 else 0,
            "min": round(min(vals), 2),
            "max": round(max(vals), 2),
        }

    constructs = [
        ("PEOU (Perceived Ease of Use)", desc_stats(peou_scores)),
        ("PU (Perceived Usefulness)", desc_stats(pu_scores)),
        ("BI (Behavioral Intention)", desc_stats(bi_scores)),
    ]

    score_rows = ""
    for name, s in constructs:
        score_rows += f"<tr><td>{name}</td><td>{s['n']}</td><td>{s['mean']}</td><td>{s['median']}</td><td>{s['stdev']}</td><td>{s['min']}</td><td>{s['max']}</td></tr>\n"

    score_table = f"""<table class="stats">
<tr><th>Construct</th><th>n</th><th>Mean</th><th>Median</th><th>SD</th><th>Min</th><th>Max</th></tr>
{score_rows}</table>"""

    # Correlation matrix
    r_pu_bi = pearson_r(pu_scores, bi_scores)
    r_peou_pu = pearson_r(peou_scores, pu_scores)
    r_peou_bi = pearson_r(peou_scores, bi_scores)

    corr_table = f"""<table class="stats">
<tr><th></th><th>PEOU</th><th>PU</th><th>BI</th></tr>
<tr><td><strong>PEOU</strong></td><td>1.00</td><td>{r_peou_pu}</td><td>{r_peou_bi}</td></tr>
<tr><td><strong>PU</strong></td><td>{r_peou_pu}</td><td>1.00</td><td>{r_pu_bi}</td></tr>
<tr><td><strong>BI</strong></td><td>{r_peou_bi}</td><td>{r_pu_bi}</td><td>1.00</td></tr>
</table>"""

    # Regression 1: PEOU → PU
    b0_1, b1_1, r2_1, t_1, p_1 = ols_simple(peou_scores, pu_scores)
    reg1_table = f"""<table class="stats">
<tr><th>Model: PU = β₀ + β₁·PEOU</th><th>Value</th></tr>
<tr><td>Intercept (β₀)</td><td>{b0_1}</td></tr>
<tr><td>Slope (β₁)</td><td>{b1_1}</td></tr>
<tr><td>R²</td><td>{r2_1}</td></tr>
<tr><td>t-statistic</td><td>{t_1}</td></tr>
<tr><td>p-value</td><td>{p_1} {"***" if p_1 < 0.001 else "**" if p_1 < 0.01 else "*" if p_1 < 0.05 else "ns"}</td></tr>
</table>"""

    # Regression 2: PEOU + PU → BI
    coeffs, r2_2 = ols_multi([peou_scores, pu_scores], bi_scores)
    b0_2, b1_peou, b2_pu = coeffs
    sig_peou = "**" if abs(b1_peou) > 0.3 else ""
    sig_pu = "**" if abs(b2_pu) > 0.3 else ""
    reg2_table = f"""<table class="stats">
<tr><th>Model: BI = β₀ + β₁·PEOU + β₂·PU</th><th>Value</th></tr>
<tr><td>Intercept (β₀)</td><td>{b0_2}</td></tr>
<tr><td>β₁ (PEOU)</td><td>{b1_peou}</td></tr>
<tr><td>β₂ (PU)</td><td>{b2_pu}</td></tr>
<tr><td>R²</td><td>{r2_2}</td></tr>
</table>"""

    # ── Dynamic interpretations ──────────────────────────────────────

    # Composite interpretation
    peou_s = constructs[0][1]
    pu_s = constructs[1][1]
    bi_s = constructs[2][1]

    def level_tag(mean, lo=3.5, hi=4.5):
        if mean >= hi:
            return "very high", "#22c55e"
        elif mean >= lo:
            return "good", "#6366f1"
        elif mean >= 2.5:
            return "moderate", "#f59e0b"
        else:
            return "low", "#ef4444"

    peou_level, peou_color = level_tag(peou_s["mean"])
    pu_level, pu_color = level_tag(pu_s["mean"])
    bi_level, bi_color = level_tag(bi_s["mean"])

    score_interp = f"""<div class="interp">
<p><strong style="color:{pu_color}">PU ({pu_level}, {pu_s['mean']}/5)</strong> — Users overwhelmingly agree the app is useful. Low SD ({pu_s['stdev']}) means almost no one disputed this.</p>
<p><strong style="color:{peou_color}">PEOU ({peou_level}, {peou_s['mean']}/5)</strong> — Good but wider spread (SD {peou_s['stdev']}). Some users found it easy, others struggled. This is the weak spot.</p>
<p><strong style="color:{bi_color}">BI ({bi_level}, {bi_s['mean']}/5)</strong> — Most intend to use it, but wide SD ({bi_s['stdev']}) means a few are skeptical.</p>
</div>"""

    # Correlation interpretation
    def strength(r):
        a = abs(r)
        if a >= 0.7:
            return "strong"
        elif a >= 0.3:
            return "moderate"
        else:
            return "weak"

    corr_interp_items = []
    if abs(r_peou_bi) >= 0.7:
        corr_interp_items.append(f"<p><strong>PEOU ↔ BI = {r_peou_bi}</strong> ({strength(r_peou_bi)}) — Ease of use is tightly linked to adoption intention. Users who found it easy are the ones who will use it.</p>")
    elif abs(r_peou_bi) >= 0.3:
        corr_interp_items.append(f"<p><strong>PEOU ↔ BI = {r_peou_bi}</strong> ({strength(r_peou_bi)}) — Ease of use moderately influences adoption intention.</p>")
    else:
        corr_interp_items.append(f"<p><strong>PEOU ↔ BI = {r_peou_bi}</strong> ({strength(r_peou_bi)}) — Ease of use has little relationship with adoption intention.</p>")

    if abs(r_pu_bi) < 0.3:
        corr_interp_items.append(f"<p><strong>PU ↔ BI = {r_pu_bi}</strong> (weak) — Usefulness barely predicts intention. Everyone already agrees it's useful, so it doesn't differentiate who will/won't adopt.</p>")
    else:
        corr_interp_items.append(f"<p><strong>PU ↔ BI = {r_pu_bi}</strong> ({strength(r_pu_bi)}) — Usefulness {'strongly' if abs(r_pu_bi) >= 0.7 else 'moderately'} predicts adoption intention.</p>")

    if abs(r_peou_pu) < 0.3:
        corr_interp_items.append(f"<p><strong>PEOU ↔ PU = {r_peou_pu}</strong> (none) — Ease of use doesn't influence perceived usefulness in this data. The two beliefs are independent.</p>")
    else:
        corr_interp_items.append(f"<p><strong>PEOU ↔ PU = {r_peou_pu}</strong> ({strength(r_peou_pu)}) — Easier systems are perceived as more useful.</p>")

    corr_interp = '<div class="interp">' + "".join(corr_interp_items) + "</div>"

    # Regression 1 interpretation
    r1_strength = "no" if r2_1 < 0.1 else "weak" if r2_1 < 0.3 else "moderate" if r2_1 < 0.6 else "strong"
    reg1_interp = f"""<div class="interp">
<p><strong>R² = {r2_1}</strong> — PEOU explains only {round(r2_1 * 100, 1)}% of PU variance. {r1_strength.title()} relationship.</p>
<p>{"PU is already maxed out (mean " + str(pu_s['mean']) + ", low variance), so ease of use doesn't move the needle." if r2_1 < 0.1 else "There is some connection between ease of use and perceived usefulness." if r2_1 >= 0.3 else "The link between ease of use and usefulness is weak in this dataset."}</p>
</div>"""

    # Regression 2 interpretation
    r2_strength = "weak" if r2_2 < 0.3 else "moderate" if r2_2 < 0.6 else "strong"
    dominant = "PEOU" if abs(b1_peou) > abs(b2_pu) else "PU"
    reg2_interp = f"""<div class="interp">
<p><strong>R² = {r2_2}</strong> — Together, PEOU and PU explain {round(r2_2 * 100, 1)}% of who intends to use the app. {r2_strength.title()} model.</p>
<p><strong>{dominant} is the dominant driver.</strong> Each 1-point increase in {dominant} → {round(abs(b1_peou) if dominant == 'PEOU' else abs(b2_pu), 2)}-point increase in intention.</p>
</div>"""

    # Bottom line
    if peou_s["mean"] < pu_s["mean"] and abs(r_peou_bi) > abs(r_pu_bi):
        bottom_line = f"""<div class="interp bottom-line">
<p><strong>Bottom Line:</strong> PU is not the problem — users agree the app is useful. <strong>PEOU is the bottleneck.</strong> The users who scored ease of use low are the ones who won't adopt it. Focus UX improvements on reducing cognitive load: simpler flows, less text, clearer step-by-step guidance.</p>
</div>"""
    elif abs(r_pu_bi) > abs(r_peou_bi):
        bottom_line = f"""<div class="interp bottom-line">
<p><strong>Bottom Line:</strong> PU drives adoption more than PEOU. Focus on communicating the value proposition — show users <em>why</em> this saves them time and stress.</p>
</div>"""
    else:
        bottom_line = f"""<div class="interp bottom-line">
<p><strong>Bottom Line:</strong> Both PEOU and PU contribute to adoption intention. Continue improving both ease of use and value communication.</p>
</div>"""

    return f"""<div class="card">
<h3>What is TAM?</h3>
<p class="meta">Technology Acceptance Model — predicts whether users will actually use a system</p>
<div class="interp">
<p><strong>PEOU</strong> (Perceived Ease of Use): "Is this easy to use?" — Items q20–q23</p>
<p><strong>PU</strong> (Perceived Usefulness): "Does this save me time/stress?" — Items q24–q27</p>
<p><strong>BI</strong> (Behavioral Intention): "Will I actually use this?" — Item q29</p>
<p>The theory says: <strong>PEOU → PU → BI</strong> (ease of use makes it feel useful, which drives adoption).</p>
</div>
</div>
<div class="card">
<h3>Composite Score Descriptives</h3>
<p class="meta">Per-respondent averages from Likert items (1–5 scale), deduplicated by user_id</p>
{score_table}
{score_interp}
</div>
<div class="card">
<h3>Correlation Matrix (Pearson r)</h3>
<p class="meta">Strength: > 0.7 strong, 0.3–0.7 moderate, &lt; 0.3 weak</p>
{corr_table}
{corr_interp}
</div>
<div class="card">
<h3>Regression 1: PEOU → PU</h3>
<p class="meta">Does ease of use predict perceived usefulness?</p>
{reg1_table}
{reg1_interp}
</div>
<div class="card">
<h3>Regression 2: PEOU + PU → BI</h3>
<p class="meta">Do ease of use and usefulness predict behavioral intention?</p>
{reg2_table}
{reg2_interp}
</div>
<div class="card">
<h3>Summary</h3>
{bottom_line}
</div>"""


def _tam_for_subset(subset):
    """Run TAM on a list of response dicts. Returns dict or None if too small."""
    peou_ids = ["q20", "q21", "q22", "q23"]
    pu_ids = ["q24", "q25", "q26", "q27"]
    bi_id = "q29"

    def avg_items(resp, ids):
        vals = [int(resp[i]) for i in ids if i in resp and str(resp[i]).isdigit()]
        return round(sum(vals) / len(vals), 2) if vals else None

    peou, pu, bi = [], [], []
    for resp in subset:
        p = avg_items(resp, peou_ids)
        u = avg_items(resp, pu_ids)
        b = int(resp[bi_id]) if bi_id in resp and str(resp[bi_id]).isdigit() else None
        if p is not None and u is not None and b is not None:
            peou.append(p)
            pu.append(u)
            bi.append(b)

    n = len(peou)
    if n < 3:
        return None

    def ds(vals):
        return {
            "n": len(vals),
            "mean": round(statistics.mean(vals), 2),
            "median": round(statistics.median(vals), 2),
            "stdev": round(statistics.stdev(vals), 2) if len(vals) > 1 else 0,
            "min": round(min(vals), 2),
            "max": round(max(vals), 2),
        }

    r_pu_bi = pearson_r(pu, bi)
    r_peou_pu = pearson_r(peou, pu)
    r_peou_bi = pearson_r(peou, bi)

    b0_1, b1_1, r2_1, t_1, p_1 = ols_simple(peou, pu)
    coeffs, r2_2 = ols_multi([peou, pu], bi)

    return {
        "peou": ds(peou), "pu": ds(pu), "bi": ds(bi),
        "r_pu_bi": r_pu_bi, "r_peou_pu": r_peou_pu, "r_peou_bi": r_peou_bi,
        "reg1": {"b0": b0_1, "b1": b1_1, "r2": r2_1, "t": t_1, "p": p_1},
        "reg2": {"coeffs": coeffs, "r2": r2_2},
    }


def _tam_card_html(result, label, warn_n=None):
    """Render a compact TAM card for one subset."""
    if result is None:
        return f'<div class="card"><h3>{label}</h3><p class="empty">Not enough data (n &lt; 3)</p></div>'

    p, u, b = result["peou"], result["pu"], result["bi"]
    warn = f' <span class="badge warn">n={p["n"]} — interpret with caution</span>' if warn_n and p["n"] <= warn_n else ""

    pvs = "ns"
    if result["reg1"]["p"] < 0.001: pvs = "***"
    elif result["reg1"]["p"] < 0.01: pvs = "**"
    elif result["reg1"]["p"] < 0.05: pvs = "*"

    return f"""<div class="card">
<h3>{label}{warn}</h3>
<table class="stats">
<tr><th></th><th>PEOU</th><th>PU</th><th>BI</th></tr>
<tr><td><strong>Mean</strong></td><td>{p['mean']}</td><td>{u['mean']}</td><td>{b['mean']}</td></tr>
<tr><td><strong>SD</strong></td><td>{p['stdev']}</td><td>{u['stdev']}</td><td>{b['stdev']}</td></tr>
</table>
<table class="stats" style="margin-top:.5rem">
<tr><th>Correlations</th><th>Value</th></tr>
<tr><td>PEOU ↔ BI</td><td>{result['r_peou_bi']}</td></tr>
<tr><td>PU ↔ BI</td><td>{result['r_pu_bi']}</td></tr>
<tr><td>PEOU → PU (R²)</td><td>{result['reg1']['r2']}</td></tr>
<tr><td>PEOU+PU → BI (R²)</td><td>{result['reg2']['r2']}</td></tr>
</table>
</div>"""


def generate_tam_chart_html(sizes, peou_means, pu_means, bi_means):
    """Build a CSS bar chart for TAM metrics by group size."""
    grid_lines = ""
    for s in range(6):
        pct = (s / 5) * 100
        grid_lines += f'<div class="tam-grid-line" style="bottom:{pct}%"><span>{s}</span></div>\n'

    cols = ""
    for i, size in enumerate(sizes):
        p, u, b = peou_means[i], pu_means[i], bi_means[i]
        cols += f"""<div class="tam-chart-col">
<div class="tam-bars">
<div class="tam-bar bar-peou" style="height:{p/5*100:.1f}%"><span class="tam-val">{p:.2f}</span></div>
<div class="tam-bar bar-pu" style="height:{u/5*100:.1f}%"><span class="tam-val">{u:.2f}</span></div>
<div class="tam-bar bar-bi" style="height:{b/5*100:.1f}%"><span class="tam-val">{b:.2f}</span></div>
</div>
<div class="tam-x-label">Size {size}</div>
</div>
"""

    return f"""<div class="tam-chart">
<div class="tam-y-axis">{grid_lines}</div>
<div class="tam-chart-area">{cols}</div>
</div>"""


def build_group_size_html(rows_with_uid):
    """Build the Group Size Analysis tab."""
    # Group by size
    from collections import defaultdict
    by_size = defaultdict(list)
    all_resps = []
    for uid, resp, gs in rows_with_uid:
        by_size[gs].append(resp)
        all_resps.append(resp)

    sizes = sorted(by_size.keys())

    # Distribution
    dist_rows = ""
    for s in sizes:
        cnt = len(by_size[s])
        pct = round(cnt / len(all_resps) * 100, 1)
        bar = f'<div style="background:var(--accent);height:18px;width:{pct}%;border-radius:4px"></div>'
        dist_rows += f"<tr><td>Group size {s}</td><td>{cnt}</td><td>{pct}%</td><td>{bar}</td></tr>\n"
    dist_table = f'<table class="stats"><tr><th>Group Size</th><th>Responses</th><th>%</th><th></th></tr>\n{dist_rows}</table>'

    # Per-size TAM
    per_size_cards = []
    chart_sizes = []
    peou_means = []
    pu_means = []
    bi_means = []
    for s in sizes:
        result = _tam_for_subset(by_size[s])
        per_size_cards.append(_tam_card_html(result, f"Group Size {s} (n={len(by_size[s])})", warn_n=5))
        if result:
            chart_sizes.append(s)
            peou_means.append(result["peou"]["mean"])
            pu_means.append(result["pu"]["mean"])
            bi_means.append(result["bi"]["mean"])

    # Generate the CSS bar chart
    chart_html = generate_tam_chart_html(chart_sizes, peou_means, pu_means, bi_means)

    # Aggregated subsets
    subsets = []
    for label, min_size in [("All ≥2", 2), ("All ≥3", 3), ("All ≥4", 4), ("All ≥5", 5)]:
        subset = [resp for uid, resp, gs in rows_with_uid if gs >= min_size]
        subsets.append((label, subset))

    agg_cards = []
    for label, subset in subsets:
        result = _tam_for_subset(subset)
        agg_cards.append(_tam_card_html(result, f"{label} (n={len(subset)})", warn_n=5))

    # Composite comparison table
    comp_rows = ""
    for s in sizes:
        result = _tam_for_subset(by_size[s])
        if result:
            p, u, b = result["peou"], result["pu"], result["bi"]
            comp_rows += f"<tr><td>Size {s}</td><td>{len(by_size[s])}</td><td>{p['mean']} (±{p['stdev']})</td><td>{u['mean']} (±{u['stdev']})</td><td>{b['mean']} (±{b['stdev']})</td><td>{result['r_peou_bi']}</td><td>{result['reg2']['r2']}</td></tr>\n"
    for label, subset in subsets:
        result = _tam_for_subset(subset)
        if result:
            p, u, b = result["peou"], result["pu"], result["bi"]
            comp_rows += f"<tr><td>{label}</td><td>{len(subset)}</td><td>{p['mean']} (±{p['stdev']})</td><td>{u['mean']} (±{u['stdev']})</td><td>{b['mean']} (±{b['stdev']})</td><td>{result['r_peou_bi']}</td><td>{result['reg2']['r2']}</td></tr>\n"
    comp_table = f"""<table class="stats">
<tr><th>Subset</th><th>n</th><th>PEOU (±SD)</th><th>PU (±SD)</th><th>BI (±SD)</th><th>PEOU↔BI</th><th>Model R²</th></tr>
{comp_rows}</table>"""

    # Best fit summary
    best_peou = max(sizes, key=lambda s: _tam_for_subset(by_size[s])["peou"]["mean"] if _tam_for_subset(by_size[s]) else 0)
    best_pu = max(sizes, key=lambda s: _tam_for_subset(by_size[s])["pu"]["mean"] if _tam_for_subset(by_size[s]) else 0)
    best_bi = max(sizes, key=lambda s: _tam_for_subset(by_size[s])["bi"]["mean"] if _tam_for_subset(by_size[s]) else 0)

    best_peou_r = _tam_for_subset(by_size[best_peou])
    best_pu_r = _tam_for_subset(by_size[best_pu])
    best_bi_r = _tam_for_subset(by_size[best_bi])

    # Determine overall best
    scores = {}
    for s in sizes:
        r = _tam_for_subset(by_size[s])
        if r:
            scores[s] = (r["peou"]["mean"] + r["pu"]["mean"] + r["bi"]["mean"]) / 3
    best_overall = max(scores, key=scores.get) if scores else None

    summary_html = f"""<div class="interp bottom-line">
<p><strong>Best PEOU:</strong> Size {best_peou} ({best_peou_r['peou']['mean']}/5)</p>
<p><strong>Best PU:</strong> Size {best_pu} ({best_pu_r['pu']['mean']}/5)</p>
<p><strong>Best BI:</strong> Size {best_bi} ({best_bi_r['bi']['mean']}/5)</p>
<p><strong>Overall best fit:</strong> Size {best_overall} (avg score: {round(scores[best_overall], 2)}/5) — highest combined PEOU + PU + BI</p>
</div>"""

    return f"""<section>
<h2>Group Size Distribution</h2>
<div class="card">
{dist_table}
</div>
</section>
<section>
<h2>Composite Scores Comparison</h2>
<div class="card">
<p class="meta">PEOU, PU, BI means and standard deviations across all subsets</p>
{comp_table}
</div>
</section>
<section>
<h2>TAM Trends by Group Size (Visualization)</h2>
<div class="card" style="padding: 1.25rem;">
<div class="chart-toggles">
<button class="chart-toggle active" onclick="toggleChart('peou')" style="border-color:#6366f1;color:#6366f1">
<span class="toggle-dot" style="background:#6366f1"></span>PEOU
</button>
<button class="chart-toggle active" onclick="toggleChart('pu')" style="border-color:#10b981;color:#10b981">
<span class="toggle-dot" style="background:#10b981"></span>PU
</button>
<button class="chart-toggle active" onclick="toggleChart('bi')" style="border-color:#f59e0b;color:#f59e0b">
<span class="toggle-dot" style="background:#f59e0b"></span>BI
</button>
</div>
{chart_html}
</div>
</section>
<section>
<h2>TAM by Group Size</h2>
<p class="meta" style="margin-bottom:1rem">Per-size breakdown — small samples flagged with warning badge</p>
{"".join(per_size_cards)}
</section>
<section>
<h2>Aggregated TAM (>2, >3, >4)</h2>
<p class="meta" style="margin-bottom:1rem">Combined subsets for larger sample sizes</p>
{"".join(agg_cards)}
</section>
<section>
<h2>Best Fit Summary</h2>
<div class="card">
{summary_html}
</div>
</section>"""


def build_html(questions, feedbacks, rows_with_uid):
    # Group questions by section
    sections = {}
    for q in questions:
        sec = q["section"]
        sections.setdefault(sec, []).append(q)

    # Deduplicated responses for demographics
    deduped_raw = dedup_by_user(rows_with_uid)
    deduped = [resp for resp, gs in deduped_raw]
    n_unique = len(deduped)

    # Identify demographics section
    import re
    demo_section = None
    for sec_name in sections:
        if "ข้อมูลทั่วไป" in sec_name or "Demographics" in sec_name:
            demo_section = sec_name
            break

    def sec_sort_key(name):
        m = re.search(r'ส่วนที่\s*([\d.]+)', name)
        return float(m.group(1)) if m else 99

    def build_stats_for_subset(qid_responses_subset, rows_subset):
        """Build stats sections for a given subset of responses."""
        body_parts = []
        for sec_name, qs in sorted(sections.items(), key=lambda x: sec_sort_key(x[0])):
            cards = []
            for q in qs:
                qid = q["id"]
                qtype = q["type"]
                qtext = q["text"]

                if sec_name == demo_section:
                    values = [v for v in qid_responses_subset.get(qid, []) if v is not None and v != ""]
                    n_label = f" (n={len(rows_subset)})"
                else:
                    values = [v for v in qid_responses_subset.get(qid, []) if v is not None and v != ""]
                    n_label = ""

                if qtype == "rating":
                    nums = [int(v) for v in values if str(v).isdigit()]
                    content = rating_table(stats_rating(nums)) if nums else '<p class="empty">No rating responses</p>'
                elif qtype == "select":
                    strs = [str(v) for v in values]
                    content = select_table(stats_select(strs)) if strs else '<p class="empty">No select responses</p>'
                elif qtype == "text":
                    content = text_list(stats_text([str(v) for v in values]))
                else:
                    content = '<p class="empty">Unknown type</p>'

                opt_badge = ' <span class="badge">optional</span>' if q.get("optional") else ""
                cards.append(f"""<div class="card">
<h3>{qtext}{opt_badge}{n_label}</h3>
<p class="meta">{q['objective']}</p>
{content}
</div>""")

            # Inject extra cards for demographics section
            if sec_name == demo_section:
                from collections import defaultdict as _dd
                # Group size distribution
                gs_counts = Counter(int(r[2]) for r in rows_subset)
                gs_meetings = _dd(set)
                for uid, resp, gs in rows_subset:
                    pass
                # Re-read to get meeting_ids per size
                subset_uids = set(r[0] for r in rows_subset)
                with open(DIR / "feedbacks_20260711.csv", encoding="utf-8") as _f:
                    for _row in csv.DictReader(_f):
                        if _row["user_id"] in subset_uids:
                            gs_meetings[int(_row["group_size"])].add(_row["meeting_id"])
                gs_rows = ""
                for s in sorted(gs_counts):
                    cnt = gs_counts[s]
                    n_groups = len(gs_meetings[s])
                    pct = round(cnt / len(rows_subset) * 100, 1)
                    bar = f'<div style="background:var(--accent);height:18px;width:{pct}%;border-radius:4px"></div>'
                    gs_rows += f"<tr><td>Group size {s}</td><td>{n_groups}</td><td>{cnt}</td><td>{pct}%</td><td>{bar}</td></tr>\n"
                cards.append(f"""<div class="card">
<h3>Group Size Distribution</h3>
<p class="meta">Unique groups (meetings) and responses per meeting size</p>
<table class="stats"><tr><th>Group Size</th><th>Groups</th><th>Responses</th><th>%</th><th></th></tr>
{gs_rows}</table>
</div>""")

                # Meeting summary
                meetings = _dd(list)
                for uid, resp, gs in rows_subset:
                    pass
                with open(DIR / "feedbacks_20260711.csv", encoding="utf-8") as _f:
                    for _row in csv.DictReader(_f):
                        uid = _row["user_id"]
                        # only include rows whose user_id is in this subset
                        subset_uids = set(r[0] for r in rows_subset)
                        if uid in subset_uids:
                            mid = _row["meeting_id"]
                            gs = int(_row["group_size"])
                            meetings[mid].append((uid, gs))

                mtg_rows = ""
                for mid in sorted(meetings, key=lambda m: -len(meetings[m])):
                    entries = meetings[mid]
                    n_resp = len(entries)
                    gs = entries[0][1]
                    users = len(set(uid for uid, _ in entries))
                    mtg_rows += f"<tr><td>{mid[:8]}...</td><td>{gs}</td><td>{n_resp}</td><td>{users}</td></tr>\n"
                cards.append(f"""<div class="card">
<h3>Meeting Summary</h3>
<p class="meta">Per-meeting breakdown</p>
<table class="stats">
<tr><th>Meeting ID</th><th>Group Size</th><th>Responses</th><th>Unique Users</th></tr>
{mtg_rows}</table>
</div>""")

                # Age by group size cross-tab
                age_gs = _dd(lambda: _dd(int))
                for uid, resp, gs in rows_subset:
                    age = resp.get("q1", "unknown")
                    age_gs[gs][age] += 1
                cross_rows = ""
                all_ages = sorted(set(resp.get("q1", "?") for _, resp, _ in rows_subset))
                for s in sorted(age_gs):
                    cells = "".join(f"<td>{age_gs[s].get(a, 0)}</td>" for a in all_ages)
                    cross_rows += f"<tr><td>Size {s}</td>{cells}</tr>\n"
                age_headers = "".join(f"<th>{a}</th>" for a in all_ages)
                cards.append(f"""<div class="card">
<h3>Age Distribution by Group Size</h3>
<p class="meta">Cross-tabulation of age groups across meeting sizes</p>
<table class="stats">
<tr><th>Group Size</th>{age_headers}</tr>
{cross_rows}</table>
</div>""")

            body_parts.append(f"""<section>
<h2>{sec_name}</h2>
{"".join(cards)}
</section>""")
        return "".join(body_parts)

    # Build stats for all 4 subsets
    # All data
    qid_all = {}
    for fb in feedbacks:
        for qid, val in fb.items():
            qid_all.setdefault(qid, []).append(val)

    # Per-subset: filter rows_with_uid by group_size
    subsets = {
        "all": rows_with_uid,
        "ge2": [r for r in rows_with_uid if r[2] >= 2],
        "ge3": [r for r in rows_with_uid if r[2] >= 3],
        "ge4": [r for r in rows_with_uid if r[2] >= 4],
    }

    subset_html = {}
    for key, rows in subsets.items():
        qid_sub = {}
        for uid, resp, gs in rows:
            for qid, val in resp.items():
                qid_sub.setdefault(qid, []).append(val)
        subset_html[key] = build_stats_for_subset(qid_sub, rows)

    # Two-column comparison layout
    stats_tab = f"""<div class="compare-wrap">
<div class="compare-toolbar">
<div class="mode-toggle">
<button class="mode-btn active" onclick="switchMode('view')">View</button>
<button class="mode-btn" onclick="switchMode('compare')">Compare</button>
</div>
<select class="compare-select" onchange="switchFilter(this.value)">
<option value="all">All Data (n={len(feedbacks)})</option>
<option value="ge2">≥2 (n={len(subsets['ge2'])})</option>
<option value="ge3">≥3 (n={len(subsets['ge3'])})</option>
<option value="ge4">≥4 (n={len(subsets['ge4'])})</option>
</select>
<span class="compare-hint" id="mode-hint">Showing selected dataset</span>
</div>
<div id="mode-view" class="mode-view">
<div id="view-all">{subset_html['all']}</div>
<div id="view-ge2" style="display:none">{subset_html['ge2']}</div>
<div id="view-ge3" style="display:none">{subset_html['ge3']}</div>
<div id="view-ge4" style="display:none">{subset_html['ge4']}</div>
</div>
<div id="mode-compare" class="mode-compare" style="display:none">
<div class="compare-cols">
<div class="compare-col"><div class="compare-col-header">All Data (n={len(feedbacks)})</div>{subset_html['all']}</div>
<div class="compare-col"><div class="compare-col-header" id="filter-header">≥2 (n={len(subsets['ge2'])})</div>
<div id="filter-ge2">{subset_html['ge2']}</div>
<div id="filter-ge3" style="display:none">{subset_html['ge3']}</div>
<div id="filter-ge4" style="display:none">{subset_html['ge4']}</div>
</div>
</div>
</div>
</div>"""

    # Split into tabs
    tam_html = build_tam_html(deduped)
    group_html = build_group_size_html(rows_with_uid)
    tam_parts = [f"""<section>
<h2>TAM Analysis (Technology Acceptance Model)</h2>
{tam_html}
</section>"""]

    tab_bar = """<nav class="tabs">
<button class="tab active" onclick="showTab('stats')">Statistical Analysis</button>
<button class="tab" onclick="showTab('tam')">TAM Evaluation</button>
<button class="tab" onclick="showTab('group')">Group Size Analysis</button>
</nav>"""

    tab_content = f"""<div id="tab-stats">{stats_tab}</div>
<div id="tab-tam" style="display:none">{"".join(tam_parts)}</div>
<div id="tab-group" style="display:none">{group_html}</div>"""

    tab_js = """<script>
function showTab(id) {
  ['stats','tam','group'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === id ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(b => {
    const map = {stats:'statistical', tam:'tam', group:'group'};
    b.classList.toggle('active', b.textContent.toLowerCase().includes(map[id]));
  });
}
let currentFilter = 'all';
let currentMode = 'view';
function switchFilter(key) {
  currentFilter = key;
  const labels = {all:'All Data', ge2:'≥2', ge3:'≥3', ge4:'≥4'};
  const hints = {all:'Showing all responses', ge2:'Showing group size ≥2', ge3:'Showing group size ≥3', ge4:'Showing group size ≥4'};
  // View mode
  ['all','ge2','ge3','ge4'].forEach(k => {
    const vEl = document.getElementById('view-' + k);
    if (vEl) vEl.style.display = k === key ? '' : 'none';
  });
  // Compare mode
  ['ge2','ge3','ge4'].forEach(k => {
    const cEl = document.getElementById('filter-' + k);
    if (cEl) cEl.style.display = k === key ? '' : 'none';
  });
  const hdr = document.getElementById('filter-header');
  if (hdr) {
    const n = document.getElementById('filter-' + key) ? document.getElementById('filter-' + key).textContent.match(/n=(\\d+)/) : null;
    hdr.textContent = labels[key] + (n ? ' (n=' + n[1] + ')' : '');
  }
  document.getElementById('mode-hint').textContent = hints[key];
}
function switchMode(mode) {
  currentMode = mode;
  document.getElementById('mode-view').style.display = mode === 'view' ? '' : 'none';
  document.getElementById('mode-compare').style.display = mode === 'compare' ? '' : 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === mode));
  document.getElementById('mode-hint').textContent = mode === 'view' ? 'Showing selected dataset' : 'All Data vs selected filter';
}
function toggleChart(factor) {
  document.querySelectorAll('.bar-' + factor).forEach(b => b.classList.toggle('hidden'));
  document.querySelector('.chart-toggle[onclick*="' + factor + '"]').classList.toggle('active');
}
</script>"""

    return f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DISHCISION Feedback Summary</title>
<style>
:root {{
  --bg: #fafaf9; --fg: #1a1a1a; --card: #fff; --border: #e5e5e5;
  --accent: #6366f1; --accent2: #a5b4fc; --muted: #6b7280;
}}
@media(prefers-color-scheme:dark){{
  :root {{
    --bg: #18181b; --fg: #fafaf9; --card: #27272a; --border: #3f3f46;
    --accent: #818cf8; --accent2: #6366f1; --muted: #a1a1aa;
  }}
}}
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--fg); line-height:1.6; padding:1.5rem; max-width:1200px; margin:auto; }}
h1 {{ font-size:1.75rem; margin-bottom:.25rem; }}
.subtitle {{ color:var(--muted); margin-bottom:1rem; font-size:.9rem; }}
.tabs {{ display:flex; gap:.5rem; margin-bottom:1.5rem; border-bottom:2px solid var(--border); padding-bottom:0; }}
.tab {{ background:none; border:none; padding:.6rem 1.2rem; font-size:.9rem; font-weight:600; color:var(--muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all .15s; }}
.tab:hover {{ color:var(--fg); }}
.tab.active {{ color:var(--accent); border-bottom-color:var(--accent); }}
section {{ margin-bottom:2.5rem; }}
section > h2 {{ font-size:1.25rem; border-bottom:2px solid var(--accent); padding-bottom:.35rem; margin-bottom:1rem; }}
.card {{ background:var(--card); border:1px solid var(--border); border-radius:10px; padding:1.25rem; margin-bottom:1rem; }}
.card h3 {{ font-size:1rem; margin-bottom:.35rem; line-height:1.5; }}
.meta {{ color:var(--muted); font-size:.8rem; margin-bottom:.75rem; }}
.badge {{ background:var(--accent2); color:#fff; font-size:.65rem; padding:2px 7px; border-radius:99px; vertical-align:middle; }}
table.stats {{ width:100%; border-collapse:collapse; font-size:.85rem; }}
table.stats th {{ text-align:left; padding:6px 8px; border-bottom:2px solid var(--border); font-weight:600; }}
table.stats td {{ padding:6px 8px; border-bottom:1px solid var(--border); }}
table.stats tr.summary td {{ border:none; padding-top:10px; font-weight:600; color:var(--muted); font-size:.8rem; }}
.text-list {{ padding-left:1.25rem; }}
.text-list li {{ margin-bottom:.5rem; font-size:.9rem; }}
.empty {{ color:var(--muted); font-style:italic; font-size:.85rem; }}
.interp {{ background:var(--bg); border-left:3px solid var(--accent); padding:.75rem 1rem; margin-top:.75rem; border-radius:0 8px 8px 0; font-size:.85rem; }}
.interp p {{ margin-bottom:.4rem; }}
.interp p:last-child {{ margin-bottom:0; }}
.bottom-line {{ border-left-color:#22c55e; background:rgba(34,197,94,.06); }}
.badge.warn {{ background:#f59e0b; }}
.chart-toggles {{ display:flex; gap:.5rem; margin-bottom:1rem; }}
.chart-toggle {{ display:flex; align-items:center; gap:.4rem; background:none; border:2px solid var(--border); border-radius:6px; padding:.3rem .7rem; font-size:.8rem; font-weight:600; cursor:pointer; transition:all .15s; opacity:.4; }}
.chart-toggle.active {{ opacity:1; background:rgba(99,102,241,.08); }}
.chart-toggle:hover {{ opacity:.8; }}
.toggle-dot {{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }}
.tam-chart {{ display:flex; gap:0; height:280px; margin:0 auto; }}
.tam-y-axis {{ width:36px; display:flex; flex-direction:column; justify-content:space-between; text-align:right; padding-right:8px; font-size:12px; color:var(--muted); position:relative; }}
.tam-grid-line {{ position:absolute; width:calc(100% + 8px); left:-8px; border-top:1px dashed var(--border); }}
.tam-grid-line span {{ position:absolute; top:-7px; right:0; font-size:11px; }}
.tam-chart-area {{ flex:1; display:flex; justify-content:space-around; align-items:flex-end; border-left:1px solid var(--border); border-bottom:1px solid var(--border); padding:0 1rem; }}
.tam-chart-col {{ flex:1; display:flex; flex-direction:column; align-items:center; height:100%; }}
.tam-bars {{ display:flex; gap:6px; align-items:flex-end; justify-content:center; height:100%; width:100%; }}
.tam-bar {{ width:clamp(28px, 6vw, 44px); border-radius:8px 8px 0 0; position:relative; transition:height .4s ease, opacity .3s; cursor:default; }}
.tam-bar:hover {{ filter:brightness(1.15); }}
.tam-bar.bar-peou {{ background:linear-gradient(180deg, #818cf8, #6366f1); }}
.tam-bar.bar-pu {{ background:linear-gradient(180deg, #34d399, #10b981); }}
.tam-bar.bar-bi {{ background:linear-gradient(180deg, #fbbf24, #f59e0b); }}
.tam-val {{ position:absolute; top:-22px; left:50%; transform:translateX(-50%); font-size:13px; font-weight:700; white-space:nowrap; color:var(--fg); }}
.tam-x-label {{ margin-top:10px; font-size:13px; font-weight:600; color:var(--fg); }}
.tam-bar.hidden {{ opacity:0.12; height:0 !important; }}
.compare-wrap {{ margin-bottom:1rem; }}
.compare-toolbar {{ display:flex; align-items:center; gap:1rem; margin-bottom:1rem; padding:.75rem 1rem; background:var(--card); border:1px solid var(--border); border-radius:10px; }}
.compare-label {{ font-weight:600; font-size:.9rem; }}
.compare-select {{ padding:.4rem .8rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg); font-size:.85rem; cursor:pointer; }}
.compare-hint {{ color:var(--muted); font-size:.8rem; margin-left:auto; }}
.mode-toggle {{ display:flex; gap:0; border:1px solid var(--border); border-radius:6px; overflow:hidden; }}
.mode-btn {{ background:none; border:none; padding:.35rem .8rem; font-size:.8rem; font-weight:600; color:var(--muted); cursor:pointer; transition:all .15s; }}
.mode-btn:hover {{ color:var(--fg); }}
.mode-btn.active {{ background:var(--accent); color:#fff; }}
.compare-cols {{ display:flex; gap:1.5rem; overflow-y:auto; max-height:80vh; }}
.compare-col {{ flex:1; min-width:0; }}
.compare-col .card {{ max-height:320px; overflow-y:auto; }}
.compare-col-header {{ position:sticky; top:0; background:var(--accent); color:#fff; padding:.5rem 1rem; border-radius:8px 8px 0 0; font-weight:600; font-size:.9rem; z-index:1; }}
@media(max-width:768px) {{
  .compare-cols {{ flex-direction:column; }}
  .compare-col {{ max-height:none; }}
}}
</style>
</head>
<body>
<h1>DISHCISION Feedback Summary</h1>
<p class="subtitle">{len(feedbacks)} responses ({n_unique} unique users) &middot; {len(questions)} questions &middot; Generated from feedbacks.csv</p>
{tab_bar}
{tab_content}
{tab_js}
</body>
</html>"""


def main():
    questions = load_questions()
    feedbacks = load_feedbacks()
    rows_with_uid = load_feedbacks_with_uid()
    html = build_html(questions, feedbacks, rows_with_uid)
    out = DIR / "summary.html"
    out.write_text(html, encoding="utf-8")
    n_unique = len({uid for uid, _, _ in rows_with_uid})
    print(f"Written to {out} ({len(feedbacks)} responses, {n_unique} unique users, {len(questions)} questions)")


if __name__ == "__main__":
    main()
