"""Backend tests for TRN/FPID review request."""
import re
import requests

BASE_URL = "https://vault-app-25.preview.emergentagent.com/api"
TRN_RE = re.compile(r"^TRN[A-Z0-9]{13}$")
FPID_RE = re.compile(r"^FP[0-9]{18}$")

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")


def main():
    # Login via passcode
    r = requests.post(f"{BASE_URL}/auth/passcode", json={"passcode": "0503"}, timeout=30)
    assert r.status_code == 200, f"passcode login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Token acquired (truncated): {token[:20]}...")

    # ---- 1. GET /api/transactions returns trn/fpid for every transaction ----
    r = requests.get(f"{BASE_URL}/transactions?limit=50", headers=headers, timeout=30)
    record("GET /api/transactions status 200", r.status_code == 200, f"status={r.status_code}")
    txns = r.json()
    record("GET /api/transactions returns list", isinstance(txns, list) and len(txns) > 0, f"count={len(txns)}")

    bad_trn = []
    bad_fpid = []
    for t in txns:
        trn = t.get("trn") or ""
        fpid = t.get("fpid") or ""
        if not TRN_RE.match(trn):
            bad_trn.append((t.get("id"), trn))
        if not FPID_RE.match(fpid):
            bad_fpid.append((t.get("id"), fpid))
    record(
        "Every transaction has valid TRN (^TRN[A-Z0-9]{13}$)",
        len(bad_trn) == 0,
        f"sample_first_trn={txns[0].get('trn')!r}, invalid_count={len(bad_trn)}, sample_bad={bad_trn[:3]}"
    )
    record(
        "Every transaction has valid FPID (^FP[0-9]{18}$)",
        len(bad_fpid) == 0,
        f"sample_first_fpid={txns[0].get('fpid')!r}, invalid_count={len(bad_fpid)}, sample_bad={bad_fpid[:3]}"
    )

    # ---- 2. GET /api/transactions/{id} contains trn/fpid ----
    pick = txns[0]
    pick_id = pick["id"]
    r1 = requests.get(f"{BASE_URL}/transactions/{pick_id}", headers=headers, timeout=30)
    record("GET /api/transactions/{id} status 200", r1.status_code == 200, f"status={r1.status_code}")
    single = r1.json()
    record(
        "Single transaction TRN valid",
        bool(TRN_RE.match(single.get("trn") or "")),
        f"trn={single.get('trn')!r}"
    )
    record(
        "Single transaction FPID valid",
        bool(FPID_RE.match(single.get("fpid") or "")),
        f"fpid={single.get('fpid')!r}"
    )

    # ---- 3. Determinism: same trn/fpid on repeat ----
    r2 = requests.get(f"{BASE_URL}/transactions/{pick_id}", headers=headers, timeout=30)
    single2 = r2.json()
    record(
        "TRN deterministic across repeated GET",
        single.get("trn") == single2.get("trn"),
        f"first={single.get('trn')!r}, second={single2.get('trn')!r}"
    )
    record(
        "FPID deterministic across repeated GET",
        single.get("fpid") == single2.get("fpid"),
        f"first={single.get('fpid')!r}, second={single2.get('fpid')!r}"
    )

    record(
        "TRN matches between list and detail endpoints",
        pick.get("trn") == single.get("trn"),
        f"list={pick.get('trn')!r}, detail={single.get('trn')!r}"
    )
    record(
        "FPID matches between list and detail endpoints",
        pick.get("fpid") == single.get("fpid"),
        f"list={pick.get('fpid')!r}, detail={single.get('fpid')!r}"
    )

    # ---- 4. POST /api/transfers persists trn/fpid ----
    r = requests.get(f"{BASE_URL}/accounts", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    accounts = r.json()
    checking = next((a for a in accounts if a.get("account_type") == "checking"), accounts[0])

    body = {
        "from_account_id": checking["id"],
        "to_account_number": "11223344",
        "amount": 12.50,
        "description": "TRN/FPID review transfer",
        "recipient_name": "Jane Doe",
        "sort_code": "20-30-40",
    }
    r = requests.post(f"{BASE_URL}/transfers", headers=headers, json=body, timeout=30)
    record("POST /api/transfers status 200", r.status_code == 200, f"status={r.status_code}, body={r.text[:200]}")
    created = r.json()
    record(
        "POST /api/transfers response contains valid TRN",
        bool(TRN_RE.match(created.get("trn") or "")),
        f"trn={created.get('trn')!r}"
    )
    record(
        "POST /api/transfers response contains valid FPID",
        bool(FPID_RE.match(created.get("fpid") or "")),
        f"fpid={created.get('fpid')!r}"
    )

    r = requests.get(f"{BASE_URL}/transactions/{created['id']}", headers=headers, timeout=30)
    refetched = r.json()
    record(
        "Persisted TRN survives GET /api/transactions/{id}",
        refetched.get("trn") == created.get("trn") and bool(TRN_RE.match(refetched.get("trn") or "")),
        f"created={created.get('trn')!r}, refetched={refetched.get('trn')!r}"
    )
    record(
        "Persisted FPID survives GET /api/transactions/{id}",
        refetched.get("fpid") == created.get("fpid") and bool(FPID_RE.match(refetched.get("fpid") or "")),
        f"created={created.get('fpid')!r}, refetched={refetched.get('fpid')!r}"
    )

    print("\n=========== TEST SUMMARY ===========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, detail in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\nTotal: {passed}/{total} passed")
    if passed != total:
        print("\nFAILED DETAILS:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name} :: {detail}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
