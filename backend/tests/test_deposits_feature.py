"""
Backend API Tests for Add Money / Deposits Feature
Tests: POST /api/deposits with validation, balance updates, transaction creation, notifications
"""
import pytest
import requests
import os
import time

# Get backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL environment variable not set")

# Test credentials
PASSCODE = "0503"

# Global variables
auth_token = None
user_id = None
checking_account_id = None
savings_account_id = None
initial_checking_balance = 0
initial_savings_balance = 0


class TestDepositsFeature:
    """Add Money / Deposits feature tests"""
    
    def test_01_login_with_passcode(self):
        """Login with passcode 0503"""
        global auth_token, user_id
        
        response = requests.post(
            f"{BASE_URL}/api/auth/passcode",
            json={"passcode": PASSCODE}
        )
        
        assert response.status_code == 200, f"Passcode login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        
        auth_token = data["access_token"]
        user_id = data["user"]["id"]
        
        print(f"✓ Logged in with passcode {PASSCODE}")
        print(f"✓ User ID: {user_id}")
    
    def test_02_get_accounts(self):
        """Get user accounts and store initial balances"""
        global checking_account_id, savings_account_id, initial_checking_balance, initial_savings_balance
        
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get accounts failed: {response.text}"
        
        accounts = response.json()
        assert len(accounts) >= 2, "Should have at least 2 accounts (checking and savings)"
        
        for acc in accounts:
            if acc["account_type"] == "checking":
                checking_account_id = acc["id"]
                initial_checking_balance = acc["balance"]
            elif acc["account_type"] == "savings":
                savings_account_id = acc["id"]
                initial_savings_balance = acc["balance"]
        
        assert checking_account_id is not None, "Checking account not found"
        assert savings_account_id is not None, "Savings account not found"
        
        print(f"✓ Retrieved {len(accounts)} accounts")
        print(f"✓ Checking account: {checking_account_id} - Balance: £{initial_checking_balance:.2f}")
        print(f"✓ Savings account: {savings_account_id} - Balance: £{initial_savings_balance:.2f}")
    
    def test_03_deposit_to_checking_bank_transfer(self):
        """Test POST /api/deposits - Deposit to checking account via bank transfer"""
        deposit_amount = 100.00
        
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": checking_account_id,
                "amount": deposit_amount,
                "source": "bank_transfer"
            }
        )
        
        assert response.status_code == 200, f"Deposit failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "new_balance" in data
        assert "transaction_id" in data
        
        expected_balance = initial_checking_balance + deposit_amount
        assert data["new_balance"] == expected_balance, f"Expected balance {expected_balance}, got {data['new_balance']}"
        
        print(f"✓ Deposit successful: £{deposit_amount:.2f}")
        print(f"✓ New balance: £{data['new_balance']:.2f}")
        print(f"✓ Transaction ID: {data['transaction_id']}")
        
        # Store transaction_id for later verification
        global deposit_transaction_id
        deposit_transaction_id = data["transaction_id"]
        
        # Wait for DB to update
        time.sleep(0.5)
    
    def test_04_verify_balance_updated(self):
        """Verify account balance was actually updated in database"""
        response = requests.get(
            f"{BASE_URL}/api/accounts/{checking_account_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get account failed: {response.text}"
        
        account = response.json()
        expected_balance = initial_checking_balance + 100.00
        assert account["balance"] == expected_balance, f"Balance not updated. Expected {expected_balance}, got {account['balance']}"
        
        print(f"✓ Balance verified in database: £{account['balance']:.2f}")
    
    def test_05_verify_transaction_created(self):
        """Verify deposit transaction was created with correct type"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        
        transactions = response.json()
        
        # Find our deposit transaction
        deposit_txn = next((t for t in transactions if t["id"] == deposit_transaction_id), None)
        assert deposit_txn is not None, "Deposit transaction not found"
        
        assert deposit_txn["transaction_type"] == "deposit", f"Expected type 'deposit', got '{deposit_txn['transaction_type']}'"
        assert deposit_txn["amount"] == 100.00
        assert deposit_txn["to_account_id"] == checking_account_id
        assert deposit_txn["status"] == "completed"
        assert "Bank Transfer" in deposit_txn["description"]
        
        print(f"✓ Transaction verified: {deposit_txn['description']}")
        print(f"✓ Transaction type: {deposit_txn['transaction_type']}")
        print(f"✓ Amount: £{deposit_txn['amount']:.2f}")
    
    def test_06_verify_notification_created(self):
        """Verify notification was created for deposit"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        
        notifications = response.json()
        
        # Find deposit notification
        deposit_notif = next((n for n in notifications if n.get("notification_type") == "deposit" and "100.00" in n.get("body", "")), None)
        assert deposit_notif is not None, "Deposit notification not found"
        
        assert deposit_notif["title"] == "Money Added"
        assert "£100.00" in deposit_notif["body"]
        assert "Current" in deposit_notif["body"] or "Checking" in deposit_notif["body"]
        assert "Bank Transfer" in deposit_notif["body"]
        
        print(f"✓ Notification verified: {deposit_notif['title']}")
        print(f"✓ Body: {deposit_notif['body']}")
    
    def test_07_deposit_to_savings_card_deposit(self):
        """Test POST /api/deposits - Deposit to savings account via card"""
        deposit_amount = 250.00
        
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": savings_account_id,
                "amount": deposit_amount,
                "source": "card_deposit"
            }
        )
        
        assert response.status_code == 200, f"Deposit failed: {response.text}"
        
        data = response.json()
        expected_balance = initial_savings_balance + deposit_amount
        assert data["new_balance"] == expected_balance
        
        print(f"✓ Card deposit to savings successful: £{deposit_amount:.2f}")
        print(f"✓ New savings balance: £{data['new_balance']:.2f}")
        
        time.sleep(0.5)
    
    def test_08_deposit_quick_topup(self):
        """Test POST /api/deposits - Quick top-up"""
        deposit_amount = 50.00
        
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": checking_account_id,
                "amount": deposit_amount,
                "source": "quick_topup"
            }
        )
        
        assert response.status_code == 200, f"Quick top-up failed: {response.text}"
        
        data = response.json()
        print(f"✓ Quick top-up successful: £{deposit_amount:.2f}")
        
        time.sleep(0.5)
    
    def test_09_deposit_with_custom_description(self):
        """Test POST /api/deposits with custom description"""
        deposit_amount = 75.00
        custom_desc = "TEST_Custom deposit description"
        
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": checking_account_id,
                "amount": deposit_amount,
                "source": "bank_transfer",
                "description": custom_desc
            }
        )
        
        assert response.status_code == 200
        
        # Verify custom description in transaction
        time.sleep(0.5)
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        transactions = response.json()
        custom_txn = next((t for t in transactions if custom_desc in t.get("description", "")), None)
        assert custom_txn is not None, "Transaction with custom description not found"
        
        print(f"✓ Custom description deposit successful")
        print(f"✓ Description: {custom_txn['description']}")
    
    def test_10_deposit_zero_amount_fails(self):
        """Test POST /api/deposits with zero amount returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": checking_account_id,
                "amount": 0,
                "source": "bank_transfer"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "positive" in response.json()["detail"].lower()
        
        print("✓ Zero amount correctly rejected with 400")
    
    def test_11_deposit_negative_amount_fails(self):
        """Test POST /api/deposits with negative amount returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": checking_account_id,
                "amount": -50.00,
                "source": "bank_transfer"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "positive" in response.json()["detail"].lower()
        
        print("✓ Negative amount correctly rejected with 400")
    
    def test_12_deposit_invalid_account_id_fails(self):
        """Test POST /api/deposits with invalid account_id returns 404"""
        fake_account_id = "fake-account-id-12345"
        
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "account_id": fake_account_id,
                "amount": 100.00,
                "source": "bank_transfer"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "not found" in response.json()["detail"].lower()
        
        print("✓ Invalid account_id correctly rejected with 404")
    
    def test_13_deposit_unauthorized_fails(self):
        """Test POST /api/deposits without auth returns 403"""
        response = requests.post(
            f"{BASE_URL}/api/deposits",
            json={
                "account_id": checking_account_id,
                "amount": 100.00,
                "source": "bank_transfer"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        print("✓ Unauthorized deposit correctly rejected with 403")
    
    def test_14_verify_deposit_in_transactions_filter(self):
        """Test deposit appears in GET /api/transactions with filter_type=received"""
        response = requests.get(
            f"{BASE_URL}/api/transactions?filter_type=received",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        transactions = response.json()
        
        # All should be deposits
        for txn in transactions:
            assert txn["transaction_type"] == "deposit", f"Expected only deposits, found {txn['transaction_type']}"
        
        # Should include our test deposits
        assert len(transactions) > 0, "Should have deposit transactions"
        
        print(f"✓ Deposits appear in filter_type=received: {len(transactions)} deposits found")


# Pytest configuration
@pytest.fixture(scope="session", autouse=True)
def setup_test_session():
    """Setup before all tests"""
    print("\n" + "="*70)
    print("Add Money / Deposits Feature Backend Tests")
    print("="*70)
    yield
    print("\n" + "="*70)
    print("Deposits Feature Backend Tests Complete")
    print("="*70)
