"""
Backend API Tests for HSBC Passcode Login and New Features
Tests: Passcode auth, GBP currency, specific card numbers, transaction filters, PDF/CSV statements, receipts
"""
import pytest
import requests
import os
import time

# Get backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL environment variable not set")

# Test credentials from test_credentials.md
VALID_PASSCODE = "0503"
INVALID_PASSCODE = "1234"
EXPECTED_USER_EMAIL = "customer@hsbc.co.uk"
EXPECTED_USER_NAME = "HSBC Customer"
EXPECTED_CARD_NUMBER = "5273400012345678"
EXPECTED_CARD_MASKED = "****5678"

# Global variables
auth_token = None
user_id = None
checking_account_id = None
savings_account_id = None
transaction_ids = []


class TestPasscodeAuthentication:
    """Test passcode login functionality"""
    
    def test_01_passcode_login_success(self):
        """Test passcode login with correct code '0503'"""
        global auth_token, user_id
        
        response = requests.post(
            f"{BASE_URL}/api/auth/passcode",
            json={"passcode": VALID_PASSCODE}
        )
        
        assert response.status_code == 200, f"Passcode login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user data in response"
        assert data["user"]["email"] == EXPECTED_USER_EMAIL, f"Expected email {EXPECTED_USER_EMAIL}, got {data['user']['email']}"
        assert data["user"]["name"] == EXPECTED_USER_NAME, f"Expected name {EXPECTED_USER_NAME}, got {data['user']['name']}"
        
        auth_token = data["access_token"]
        user_id = data["user"]["id"]
        
        print(f"✓ Passcode login successful with code {VALID_PASSCODE}")
        print(f"✓ User: {data['user']['name']} ({data['user']['email']})")
        print(f"✓ Token: {auth_token[:20]}...")
    
    def test_02_passcode_login_wrong_code(self):
        """Test passcode login with wrong code returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/passcode",
            json={"passcode": INVALID_PASSCODE}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        assert "Invalid passcode" in response.json()["detail"]
        print(f"✓ Invalid passcode {INVALID_PASSCODE} correctly rejected with 401")
    
    def test_03_passcode_login_idempotent(self):
        """Test passcode login is idempotent (can login multiple times)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/passcode",
            json={"passcode": VALID_PASSCODE}
        )
        
        assert response.status_code == 200, "Second login should succeed"
        data = response.json()
        assert data["user"]["email"] == EXPECTED_USER_EMAIL
        print("✓ Passcode login is idempotent (can login multiple times)")


class TestAccountsAndCards:
    """Test accounts and cards created on first passcode login"""
    
    def test_01_get_accounts(self):
        """Test accounts are created with correct GBP currency and balances"""
        global checking_account_id, savings_account_id
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/accounts", headers=headers)
        
        assert response.status_code == 200, f"Get accounts failed: {response.text}"
        
        accounts = response.json()
        assert len(accounts) >= 2, f"Expected at least 2 accounts, got {len(accounts)}"
        
        # Find checking and savings accounts
        checking = next((a for a in accounts if a["account_type"] == "checking"), None)
        savings = next((a for a in accounts if a["account_type"] == "savings"), None)
        
        assert checking is not None, "Checking account not found"
        assert savings is not None, "Savings account not found"
        
        # Verify GBP currency
        assert checking["currency"] == "GBP", f"Expected GBP, got {checking['currency']}"
        assert savings["currency"] == "GBP", f"Expected GBP, got {savings['currency']}"
        
        # Verify balances
        assert checking["balance"] == 5000.00, f"Expected £5000 in checking, got £{checking['balance']}"
        assert savings["balance"] == 10000.00, f"Expected £10000 in savings, got £{savings['balance']}"
        
        checking_account_id = checking["id"]
        savings_account_id = savings["id"]
        
        print(f"✓ Checking account: £{checking['balance']} GBP")
        print(f"✓ Savings account: £{savings['balance']} GBP")
    
    def test_02_get_cards(self):
        """Test cards are created with specific card number 5273400012345678"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/cards", headers=headers)
        
        assert response.status_code == 200, f"Get cards failed: {response.text}"
        
        cards = response.json()
        assert len(cards) >= 1, f"Expected at least 1 card, got {len(cards)}"
        
        # Find the debit card with specific number
        debit_card = next((c for c in cards if c["card_type"] == "debit"), None)
        assert debit_card is not None, "Debit card not found"
        
        # Verify card number (full number stored in backend)
        assert debit_card["card_number"] == EXPECTED_CARD_NUMBER, \
            f"Expected card number {EXPECTED_CARD_NUMBER}, got {debit_card['card_number']}"
        
        # Verify masked card number
        assert debit_card["card_number_masked"] == EXPECTED_CARD_MASKED, \
            f"Expected masked number {EXPECTED_CARD_MASKED}, got {debit_card['card_number_masked']}"
        
        print(f"✓ Debit card found: {debit_card['card_name']}")
        print(f"✓ Card number: {debit_card['card_number']}")
        print(f"✓ Masked number: {debit_card['card_number_masked']}")


class TestTransactions:
    """Test transactions and filters"""
    
    def test_01_get_all_transactions(self):
        """Test 20 random transactions are created with amounts £10-£140"""
        global transaction_ids
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions?limit=100", headers=headers)
        
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        
        transactions = response.json()
        assert len(transactions) >= 20, f"Expected at least 20 transactions, got {len(transactions)}"
        
        # Verify amounts are in range £10-£140
        for txn in transactions[:20]:  # Check first 20
            amount = txn["amount"]
            assert 10 <= amount <= 140, f"Transaction amount £{amount} outside range £10-£140"
        
        transaction_ids = [txn["id"] for txn in transactions]
        
        print(f"✓ Found {len(transactions)} transactions")
        print(f"✓ Sample amounts: £{transactions[0]['amount']}, £{transactions[1]['amount']}, £{transactions[2]['amount']}")
    
    def test_02_filter_sent_transactions(self):
        """Test filter_type=sent returns only transfers and payments"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions?filter_type=sent", headers=headers)
        
        assert response.status_code == 200, f"Get sent transactions failed: {response.text}"
        
        transactions = response.json()
        
        # Verify all are transfers or payments
        for txn in transactions:
            assert txn["transaction_type"] in ["transfer", "payment"], \
                f"Expected transfer/payment, got {txn['transaction_type']}"
        
        print(f"✓ Filter 'sent': {len(transactions)} transactions (all transfers/payments)")
    
    def test_03_filter_received_transactions(self):
        """Test filter_type=received returns only deposits"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions?filter_type=received", headers=headers)
        
        assert response.status_code == 200, f"Get received transactions failed: {response.text}"
        
        transactions = response.json()
        
        # Verify all are deposits
        for txn in transactions:
            assert txn["transaction_type"] == "deposit", \
                f"Expected deposit, got {txn['transaction_type']}"
        
        print(f"✓ Filter 'received': {len(transactions)} transactions (all deposits)")


class TestStatements:
    """Test CSV and PDF statement downloads"""
    
    def test_01_download_csv_statement(self):
        """Test GET /api/statements/csv returns CSV file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/statements/csv", headers=headers)
        
        assert response.status_code == 200, f"CSV download failed: {response.status_code}"
        
        # Verify content type
        content_type = response.headers.get('content-type', '')
        assert 'csv' in content_type.lower() or 'text' in content_type.lower(), \
            f"Expected CSV content type, got {content_type}"
        
        # Verify content disposition header
        content_disp = response.headers.get('content-disposition', '')
        assert 'attachment' in content_disp.lower(), "Missing attachment header"
        assert 'HSBC_Statement' in content_disp, "Missing HSBC_Statement in filename"
        assert '.csv' in content_disp, "Missing .csv extension"
        
        # Verify CSV content
        csv_content = response.text
        assert len(csv_content) > 0, "CSV file is empty"
        assert 'Date' in csv_content, "CSV missing Date header"
        assert 'Type' in csv_content, "CSV missing Type header"
        assert 'Amount' in csv_content, "CSV missing Amount header"
        
        lines = csv_content.split('\n')
        assert len(lines) > 1, "CSV has no data rows"
        
        print(f"✓ CSV statement downloaded successfully")
        print(f"✓ Content-Type: {content_type}")
        print(f"✓ CSV has {len(lines)} lines")
    
    def test_02_download_pdf_statement(self):
        """Test GET /api/statements/pdf returns PDF file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/statements/pdf", headers=headers)
        
        assert response.status_code == 200, f"PDF download failed: {response.status_code}"
        
        # Verify content type
        content_type = response.headers.get('content-type', '')
        assert 'pdf' in content_type.lower(), f"Expected PDF content type, got {content_type}"
        
        # Verify content disposition header
        content_disp = response.headers.get('content-disposition', '')
        assert 'attachment' in content_disp.lower(), "Missing attachment header"
        assert 'HSBC_Statement' in content_disp, "Missing HSBC_Statement in filename"
        assert '.pdf' in content_disp, "Missing .pdf extension"
        
        # Verify PDF content (starts with %PDF)
        pdf_content = response.content
        assert len(pdf_content) > 0, "PDF file is empty"
        assert pdf_content[:4] == b'%PDF', "Invalid PDF file (missing %PDF header)"
        
        print(f"✓ PDF statement downloaded successfully")
        print(f"✓ Content-Type: {content_type}")
        print(f"✓ PDF size: {len(pdf_content)} bytes")


class TestReceipts:
    """Test individual transaction receipt PDFs"""
    
    def test_01_get_transaction_receipt(self):
        """Test GET /api/receipts/{id} returns PDF receipt"""
        assert len(transaction_ids) > 0, "No transactions available for receipt test"
        
        txn_id = transaction_ids[0]
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/receipts/{txn_id}", headers=headers)
        
        assert response.status_code == 200, f"Receipt download failed: {response.status_code}"
        
        # Verify content type
        content_type = response.headers.get('content-type', '')
        assert 'pdf' in content_type.lower(), f"Expected PDF content type, got {content_type}"
        
        # Verify content disposition header
        content_disp = response.headers.get('content-disposition', '')
        assert 'attachment' in content_disp.lower(), "Missing attachment header"
        assert 'HSBC_Receipt' in content_disp, "Missing HSBC_Receipt in filename"
        assert '.pdf' in content_disp, "Missing .pdf extension"
        
        # Verify PDF content
        pdf_content = response.content
        assert len(pdf_content) > 0, "Receipt PDF is empty"
        assert pdf_content[:4] == b'%PDF', "Invalid PDF file (missing %PDF header)"
        
        print(f"✓ Transaction receipt downloaded successfully")
        print(f"✓ Transaction ID: {txn_id[:12]}...")
        print(f"✓ PDF size: {len(pdf_content)} bytes")
    
    def test_02_receipt_not_found(self):
        """Test receipt for non-existent transaction returns 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/receipts/{fake_id}", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent receipt correctly returns 404")


class TestUnauthorizedAccess:
    """Test endpoints require authentication"""
    
    def test_01_transactions_unauthorized(self):
        """Test transactions endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Transactions endpoint requires authentication")
    
    def test_02_statements_unauthorized(self):
        """Test statements endpoints require auth"""
        response = requests.get(f"{BASE_URL}/api/statements/csv")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        response = requests.get(f"{BASE_URL}/api/statements/pdf")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Statements endpoints require authentication")
    
    def test_03_receipts_unauthorized(self):
        """Test receipts endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/receipts/fake-id")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Receipts endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
