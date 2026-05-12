"""
Focused backend tests for VaultBank/HSBC review request:
1) PUT /api/cards/{card_id}
2) GET /api/transactions/{id}
3) POST /api/transfers (recipient persistence + UK Bank fallback)
"""
import sys
import json
import requests

BASE_URL = "https://vault-app-25.preview.emergentagent.com/api"

results = []

def record(name, passed, detail=""):
    results.append((name, passed, detail))
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if detail:
        print(f"       {detail}")


def main():
    r = requests.post(f"{BASE_URL}/auth/passcode", json={"passcode": "0503"}, timeout=30)
    if r.status_code != 200:
        record("passcode_login", False, f"status={r.status_code} body={r.text}")
        return
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Got token (len={len(token)})\n")

    # ---------------- 1. PUT /api/cards/{card_id} ----------------
    print("=== Test 1: PUT /api/cards/{card_id} ===")
    r = requests.get(f"{BASE_URL}/cards", headers=headers, timeout=30)
    if r.status_code != 200 or not r.json():
        record("get_cards (precondition)", False, f"{r.status_code} {r.text}")
        return
    cards = r.json()
    card_id = cards[0]["id"]
    print(f"Picked card_id={card_id} original_name={cards[0].get('card_name')}")

    payload = {
        "card_name": "OLIVER SMITH",
        "card_number": "4567890123451234",
        "expiry_date": "12/29",
    }
    r = requests.put(f"{BASE_URL}/cards/{card_id}", json=payload, headers=headers, timeout=30)
    if r.status_code != 200:
        record("PUT /cards full update returns 200", False, f"status={r.status_code} body={r.text}")
    else:
        body = r.json()
        print("Response sample:", json.dumps({k: body.get(k) for k in
              ["id", "card_name", "card_number", "card_number_masked", "expiry_date"]}, indent=2))
        ok = (
            body.get("card_name") == "OLIVER SMITH"
            and body.get("card_number") == "4567890123451234"
            and body.get("card_number_masked") == "****1234"
            and body.get("expiry_date") == "12/29"
        )
        record("PUT /cards updates name/number/expiry and masks", ok,
               f"name={body.get('card_name')} number={body.get('card_number')} "
               f"masked={body.get('card_number_masked')} expiry={body.get('expiry_date')}")

    r = requests.put(f"{BASE_URL}/cards/{card_id}", json={"card_number": "abc"},
                     headers=headers, timeout=30)
    record("PUT /cards invalid card_number returns 400",
           r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    r = requests.put(f"{BASE_URL}/cards/{card_id}", json={},
                     headers=headers, timeout=30)
    record("PUT /cards empty body returns 400",
           r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    # ---------------- 2. GET /api/transactions/{id} ----------------
    print("\n=== Test 2: GET /api/transactions/{id} ===")
    r = requests.get(f"{BASE_URL}/transactions", headers=headers, timeout=30)
    if r.status_code != 200 or not r.json():
        record("get_transactions (precondition)", False, f"{r.status_code} {r.text}")
        return
    txns = r.json()
    txn = txns[0]
    txn_id = txn["id"]
    print(f"Picked txn_id={txn_id} amount={txn.get('amount')} type={txn.get('transaction_type')}")

    r = requests.get(f"{BASE_URL}/transactions/{txn_id}", headers=headers, timeout=30)
    if r.status_code != 200:
        record("GET /transactions/{id} returns 200", False, f"status={r.status_code} body={r.text}")
    else:
        single = r.json()
        ok = (
            single.get("id") == txn_id
            and single.get("amount") == txn.get("amount")
            and single.get("transaction_type") == txn.get("transaction_type")
            and single.get("description") == txn.get("description")
        )
        record("GET /transactions/{id} returns matching Transaction", ok,
               f"got id={single.get('id')} amount={single.get('amount')} "
               f"type={single.get('transaction_type')}")

    r = requests.get(f"{BASE_URL}/transactions/nonexistent-id", headers=headers, timeout=30)
    record("GET /transactions/nonexistent-id returns 404",
           r.status_code == 404, f"status={r.status_code} body={r.text[:200]}")

    # ---------------- 3. POST /api/transfers ----------------
    print("\n=== Test 3: POST /api/transfers ===")
    r = requests.get(f"{BASE_URL}/accounts", headers=headers, timeout=30)
    if r.status_code != 200 or not r.json():
        record("get_accounts (precondition)", False, f"{r.status_code} {r.text}")
        return
    accounts = r.json()
    from_account = accounts[0]
    from_account_id = from_account["id"]
    print(f"Picked from_account_id={from_account_id} balance={from_account.get('balance')}")

    transfer_payload = {
        "from_account_id": from_account_id,
        "to_account_number": "99887766",
        "amount": 1.00,
        "description": "Test invoice",
        "recipient_name": "Test Payee",
        "sort_code": "55-55-55",
    }
    r = requests.post(f"{BASE_URL}/transfers", json=transfer_payload, headers=headers, timeout=30)
    if r.status_code != 200:
        record("POST /transfers returns 200", False, f"status={r.status_code} body={r.text}")
        return
    txn_resp = r.json()
    print("Transfer response sample:", json.dumps({k: txn_resp.get(k) for k in
          ["id", "amount", "recipient_name", "recipient_sort_code",
           "recipient_account_number", "recipient_bank_name"]}, indent=2))

    ok = (
        txn_resp.get("recipient_sort_code") == "55-55-55"
        and txn_resp.get("recipient_account_number") == "99887766"
        and txn_resp.get("recipient_bank_name") == "UK Bank"
    )
    record("POST /transfers persists recipient fields + UK Bank fallback (response)", ok,
           f"sort={txn_resp.get('recipient_sort_code')} "
           f"acct={txn_resp.get('recipient_account_number')} "
           f"bank={txn_resp.get('recipient_bank_name')}")

    new_txn_id = txn_resp.get("id")
    r = requests.get(f"{BASE_URL}/transactions/{new_txn_id}", headers=headers, timeout=30)
    if r.status_code != 200:
        record("GET /transactions/{new_id} after transfer", False, f"{r.status_code} {r.text}")
    else:
        fetched = r.json()
        ok = (
            fetched.get("recipient_sort_code") == "55-55-55"
            and fetched.get("recipient_account_number") == "99887766"
            and fetched.get("recipient_bank_name") == "UK Bank"
        )
        record("GET /transactions/{id} reflects persisted recipient fields", ok,
               f"sort={fetched.get('recipient_sort_code')} "
               f"acct={fetched.get('recipient_account_number')} "
               f"bank={fetched.get('recipient_bank_name')}")

    print("\n" + "=" * 60)
    passed = sum(1 for _, p, _ in results if p)
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {len(results) - passed}")
    for n, p, d in results:
        print(f"  [{'PASS' if p else 'FAIL'}] {n}")
    if passed != len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
