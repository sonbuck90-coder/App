"""Backend test for 5 new endpoints: FX rate, FX currencies, International transfer,
DELETE transaction, Monthly statement PDF.

Runs against the public backend URL via EXPO_PUBLIC_BACKEND_URL (Expo) /api.
"""
import os
import re
import json
import sys
import requests
from pathlib import Path

ROOT = Path(__file__).parent
env_file = ROOT / "frontend" / ".env"
BACKEND_URL = None
for line in env_file.read_text().splitlines():
    line = line.strip()
    if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("REACT_APP_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

if not BACKEND_URL:
    print("ERROR: Could not read backend URL from frontend/.env")
    sys.exit(1)

API = f"{BACKEND_URL}/api"
print(f"Testing API base: {API}")

results = []
def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, passed, detail))
    print(f"[{status}] {name} -- {detail}")

def fresh_token(passcode="1234"):
    r = requests.post(f"{API}/auth/passcode", json={"passcode": passcode}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}

# ===== Auth sanity =====
try:
    token = fresh_token("1234")
    record("auth/passcode 1234", True, f"Got token len={len(token)}")
except Exception as e:
    record("auth/passcode 1234", False, str(e))
    print(json.dumps([(n, p, d) for n, p, d in results], indent=2))
    sys.exit(1)

# ===== 1) GET /api/fx/rate =====
print("\n=== 1) GET /api/fx/rate ===")
token = fresh_token("1234")

def test_fx(from_ccy, to_ccy, expect_rate_1=False):
    r = requests.get(f"{API}/fx/rate", params={"from_ccy": from_ccy, "to_ccy": to_ccy}, headers=auth(token), timeout=30)
    if r.status_code != 200:
        record(f"fx/rate {from_ccy}->{to_ccy}", False, f"status={r.status_code} body={r.text[:300]}")
        return None
    j = r.json()
    required = {"from", "to", "rate", "amount", "converted", "source"}
    missing = required - set(j.keys())
    if missing:
        record(f"fx/rate {from_ccy}->{to_ccy}", False, f"missing keys {missing}; body={j}")
        return None
    if not isinstance(j["rate"], (int, float)) or j["rate"] <= 0:
        record(f"fx/rate {from_ccy}->{to_ccy}", False, f"rate not > 0: {j}")
        return None
    if j["source"] not in ("open.er-api.com", "fallback"):
        record(f"fx/rate {from_ccy}->{to_ccy}", False, f"bad source: {j['source']}")
        return None
    if expect_rate_1 and float(j["rate"]) != 1.0:
        record(f"fx/rate {from_ccy}->{to_ccy}", False, f"expected rate=1.0 got {j['rate']}")
        return None
    record(f"fx/rate {from_ccy}->{to_ccy}", True, f"rate={j['rate']}, source={j['source']}, converted={j['converted']}")
    return j

test_fx("GBP", "EUR")
test_fx("USD", "JPY")
test_fx("GBP", "GBP", expect_rate_1=True)

# ===== 2) GET /api/fx/currencies =====
print("\n=== 2) GET /api/fx/currencies ===")
token = fresh_token("2222")
r = requests.get(f"{API}/fx/currencies", headers=auth(token), timeout=30)
if r.status_code != 200:
    record("fx/currencies", False, f"status={r.status_code} body={r.text[:300]}")
else:
    j = r.json()
    if not isinstance(j, list):
        record("fx/currencies", False, f"not a list: {type(j)}")
    elif len(j) < 15:
        record("fx/currencies", False, f"only {len(j)} currencies, need >=15")
    else:
        required_keys = {"code", "name", "symbol", "flag"}
        bad = [c for c in j if not required_keys.issubset(set(c.keys()))]
        if bad:
            record("fx/currencies", False, f"items missing keys: {bad[:3]}")
        else:
            codes = {c["code"] for c in j}
            sample = {"GBP","USD","EUR","JPY","AUD","INR","CHF","CNY"}
            missing_codes = sample - codes
            if missing_codes:
                record("fx/currencies", False, f"missing codes: {missing_codes}")
            else:
                record("fx/currencies", True, f"{len(j)} currencies; sample {sorted(sample)} present")

# ===== 3) POST /api/transfers/international =====
print("\n=== 3) POST /api/transfers/international ===")
token = fresh_token("3333")

r = requests.get(f"{API}/accounts", headers=auth(token), timeout=30)
if r.status_code != 200 or not r.json():
    record("get accounts (precondition)", False, f"status={r.status_code} body={r.text[:300]}")
    sys.exit(1)
accounts = r.json()
from_acc = next((a for a in accounts if a.get("account_type") == "checking"), accounts[0])
from_acc_id = from_acc["id"]
record("get accounts (precondition)", True, f"using {from_acc_id} (balance={from_acc.get('balance')})")

# Ensure sufficient balance
requests.post(f"{API}/deposits", json={"account_id": from_acc_id, "amount": 10000.0, "source": "bank_transfer"}, headers=auth(token), timeout=30)

intl_body = {
    "from_account_id": from_acc_id,
    "amount": 100.0,
    "source_currency": "GBP",
    "target_currency": "EUR",
    "recipient_name": "Maria Garcia",
    "iban": "DE89370400440532013000",
    "swift_bic": "DEUTDEFFXXX",
    "recipient_country": "Germany",
    "purpose": "Family support",
    "charges_option": "SHA",
    "is_business": False,
}
intl_txn_id = None
r = requests.post(f"{API}/transfers/international", json=intl_body, headers=auth(token), timeout=30)
if r.status_code != 200:
    record("transfers/international personal", False, f"status={r.status_code} body={r.text[:400]}")
else:
    j = r.json()
    ok = True
    notes = []
    if j.get("amount_sent") != 100.0:
        ok = False; notes.append(f"amount_sent={j.get('amount_sent')}")
    if j.get("source_currency") != "GBP":
        ok = False; notes.append(f"source_currency={j.get('source_currency')}")
    if j.get("target_currency") != "EUR":
        ok = False; notes.append(f"target_currency={j.get('target_currency')}")
    if not isinstance(j.get("amount_received"), (int, float)):
        ok = False; notes.append(f"amount_received={j.get('amount_received')}")
    if not isinstance(j.get("fx_rate"), (int, float)):
        ok = False; notes.append(f"fx_rate={j.get('fx_rate')}")
    if not re.match(r"^TRN[A-Z0-9]{13}$", j.get("trn", "") or ""):
        ok = False; notes.append(f"trn={j.get('trn')}")
    if not re.match(r"^FP\d{18}$", j.get("fpid", "") or ""):
        ok = False; notes.append(f"fpid={j.get('fpid')}")
    if j.get("status") != "completed":
        ok = False; notes.append(f"status={j.get('status')}")
    if not j.get("transaction_id"):
        ok = False; notes.append("no transaction_id")
    intl_txn_id = j.get("transaction_id")
    record("transfers/international personal", ok, f"trn={j.get('trn')} fpid={j.get('fpid')} amt_recv={j.get('amount_received')} fx={j.get('fx_rate')} status={j.get('status')} {'; ' + '; '.join(notes) if notes else ''}")

if intl_txn_id:
    r2 = requests.get(f"{API}/transactions/{intl_txn_id}", headers=auth(token), timeout=30)
    if r2.status_code != 200:
        record("verify intl txn (GET /transactions/{id})", False, f"status={r2.status_code} body={r2.text[:300]}")
    else:
        t = r2.json()
        ok2 = True
        notes2 = []
        if t.get("transaction_type") != "international":
            ok2 = False; notes2.append(f"transaction_type={t.get('transaction_type')}")
        if t.get("recipient_account_number") != intl_body["iban"]:
            ok2 = False; notes2.append(f"recipient_account_number={t.get('recipient_account_number')}")
        record("verify intl txn (GET /transactions/{id})", ok2, "; ".join(notes2) if notes2 else f"type=international, IBAN={t.get('recipient_account_number')}")

# Business transfer
biz_body = dict(intl_body)
biz_body["is_business"] = True
biz_body["invoice_number"] = "INV-2024-001"
r = requests.post(f"{API}/transfers/international", json=biz_body, headers=auth(token), timeout=30)
if r.status_code != 200:
    record("transfers/international business", False, f"status={r.status_code} body={r.text[:400]}")
else:
    j = r.json()
    ok = (j.get("status") == "completed"
          and j.get("amount_sent") == 100.0
          and bool(re.match(r"^TRN[A-Z0-9]{13}$", j.get("trn", "") or ""))
          and bool(re.match(r"^FP\d{18}$", j.get("fpid", "") or "")))
    record("transfers/international business", ok, f"trn={j.get('trn')} fpid={j.get('fpid')} status={j.get('status')}")

# ===== 4) DELETE /api/transactions/{id} =====
print("\n=== 4) DELETE /api/transactions/{id} ===")
token = fresh_token("4444")

r = requests.get(f"{API}/accounts", headers=auth(token), timeout=30)
acc_id = r.json()[0]["id"]
requests.post(f"{API}/deposits", json={"account_id": acc_id, "amount": 200.0, "source": "bank_transfer"}, headers=auth(token), timeout=30)
r = requests.post(f"{API}/transfers", json={
    "from_account_id": acc_id,
    "to_account_number": "11223344",
    "amount": 12.5,
    "description": "Test for delete",
    "recipient_name": "Delete Test",
    "sort_code": "20-30-40",
}, headers=auth(token), timeout=30)
if r.status_code != 200:
    record("delete txn: create transfer (precondition)", False, f"status={r.status_code} body={r.text[:300]}")
else:
    txn = r.json()
    txn_id = txn["id"]
    record("delete txn: create transfer (precondition)", True, f"created id={txn_id}")

    r = requests.delete(f"{API}/transactions/{txn_id}", headers=auth(token), timeout=30)
    if r.status_code != 200:
        record("DELETE /transactions/{id}", False, f"status={r.status_code} body={r.text[:300]}")
    else:
        j = r.json()
        ok = j.get("id") == txn_id and "message" in j
        record("DELETE /transactions/{id}", ok, f"response={j}")

    r = requests.get(f"{API}/transactions/{txn_id}", headers=auth(token), timeout=30)
    record("GET deleted txn -> 404", r.status_code == 404, f"status={r.status_code}")

r = requests.delete(f"{API}/transactions/doesnotexist", headers=auth(token), timeout=30)
record("DELETE non-existent -> 404", r.status_code == 404, f"status={r.status_code}")

# ===== 5) GET /api/statements/monthly =====
print("\n=== 5) GET /api/statements/monthly ===")
token = fresh_token("5555")

r = requests.get(f"{API}/statements/monthly", params={"year": 2025, "month": 11}, headers=auth(token), timeout=60)
if r.status_code != 200:
    record("statements/monthly 2025/11", False, f"status={r.status_code} body={r.text[:500]}")
else:
    ct = r.headers.get("Content-Type", "")
    cd = r.headers.get("Content-Disposition", "")
    body_head = r.content[:10]
    issues = []
    if "application/pdf" not in ct:
        issues.append(f"Content-Type={ct}")
    if "HSBC_Statement_2025_11.pdf" not in cd:
        issues.append(f"Content-Disposition={cd}")
    if not r.content.startswith(b"%PDF-"):
        issues.append(f"body starts with {body_head!r}")
    if issues:
        record("statements/monthly 2025/11", False, "; ".join(issues))
    else:
        record("statements/monthly 2025/11", True, f"PDF {len(r.content)} bytes; ct={ct}; cd contains HSBC_Statement_2025_11.pdf")

r = requests.get(f"{API}/statements/monthly", params={"year": 2025, "month": 13}, headers=auth(token), timeout=30)
if r.status_code != 400:
    record("statements/monthly month=13 -> 400", False, f"status={r.status_code} body={r.text[:300]}")
else:
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    ok = "Month must be between 1 and 12" in detail
    record("statements/monthly month=13 -> 400", ok, f"detail={detail}")

# ===== Summary =====
print("\n=========== SUMMARY ===========")
passed = sum(1 for _, p, _ in results if p)
total = len(results)
print(f"{passed}/{total} passed\n")
for name, p, detail in results:
    print(f"[{'PASS' if p else 'FAIL'}] {name} -- {detail}")

sys.exit(0 if passed == total else 1)
