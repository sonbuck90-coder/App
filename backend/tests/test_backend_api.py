"""
Backend API Tests for HSBC Bank App
Tests: Auth (register, login), Accounts, Transfers, Dashboard
"""
import pytest
import requests
import os
import uuid

# Get backend URL from environment - use the public URL for testing
BASE_URL = "https://vault-app-25.preview.emergentagent.com"

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@hsbc.com"
TEST_PASSWORD = "Test123!"
TEST_NAME = "Test User"

# Global variables to store auth token and account info
auth_token = None
user_id = None
account_id = None


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_backend_url_configured(self):
        """Verify backend URL is configured"""
        assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not configured"
        assert BASE_URL.startswith('http'), f"Invalid backend URL: {BASE_URL}"
        print(f"✓ Backend URL configured: {BASE_URL}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_01_register_new_user(self):
        """Test user registration"""
        global auth_token, user_id
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user data in response"
        assert data["user"]["email"] == TEST_EMAIL, "Email mismatch"
        assert data["user"]["name"] == TEST_NAME, "Name mismatch"
        
        auth_token = data["access_token"]
        user_id = data["user"]["id"]
        
        print(f"✓ User registered successfully: {TEST_EMAIL}")
        print(f"✓ User ID: {user_id}")
    
    def test_02_register_duplicate_email(self):
        """Test registration with duplicate email fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": "Another User"
            }
        )
        
        assert response.status_code == 400, "Should fail with duplicate email"
        assert "already registered" in response.json()["detail"].lower()
        print("✓ Duplicate email registration correctly rejected")
    
    def test_03_login_success(self):
        """Test login with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user data in response"
        assert data["user"]["email"] == TEST_EMAIL
        
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_04_login_wrong_password(self):
        """Test login with wrong password fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": "WrongPassword123!"
            }
        )
        
        assert response.status_code == 401, "Should fail with wrong password"
        print("✓ Wrong password correctly rejected")
    
    def test_05_login_nonexistent_user(self):
        """Test login with non-existent email fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@hsbc.com",
                "password": TEST_PASSWORD
            }
        )
        
        assert response.status_code == 401, "Should fail with non-existent user"
        print("✓ Non-existent user login correctly rejected")
    
    def test_06_get_current_user(self):
        """Test getting current user info with token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get user failed: {response.text}"
        
        data = response.json()
        assert data["email"] == TEST_EMAIL
        assert data["name"] == TEST_NAME
        assert data["id"] == user_id
        
        print(f"✓ Current user retrieved: {data['name']}")


class TestAccounts:
    """Account endpoint tests"""
    
    def test_01_get_all_accounts(self):
        """Test getting all user accounts"""
        global account_id
        
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get accounts failed: {response.text}"
        
        accounts = response.json()
        assert isinstance(accounts, list), "Accounts should be a list"
        assert len(accounts) >= 2, "Should have at least 2 default accounts (checking + savings)"
        
        # Verify account structure
        for account in accounts:
            assert "id" in account
            assert "account_number" in account
            assert "account_type" in account
            assert "balance" in account
            assert account["account_type"] in ["checking", "savings"]
        
        # Store first account ID for later tests
        account_id = accounts[0]["id"]
        
        print(f"✓ Retrieved {len(accounts)} accounts")
        for acc in accounts:
            print(f"  - {acc['account_type']}: ${acc['balance']:.2f}")
    
    def test_02_get_account_by_id(self):
        """Test getting specific account by ID"""
        response = requests.get(
            f"{BASE_URL}/api/accounts/{account_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get account failed: {response.text}"
        
        account = response.json()
        assert account["id"] == account_id
        assert "balance" in account
        assert "account_number" in account
        
        print(f"✓ Retrieved account {account_id}: ${account['balance']:.2f}")
    
    def test_03_get_account_unauthorized(self):
        """Test getting account without auth token fails"""
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}")
        
        assert response.status_code == 403, "Should fail without auth token"
        print("✓ Unauthorized account access correctly rejected")
    
    def test_04_verify_default_balances(self):
        """Test that default accounts have correct starting balances"""
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        accounts = response.json()
        
        checking = next((a for a in accounts if a["account_type"] == "checking"), None)
        savings = next((a for a in accounts if a["account_type"] == "savings"), None)
        
        assert checking is not None, "Checking account not found"
        assert savings is not None, "Savings account not found"
        
        # Default balances from registration
        assert checking["balance"] == 5000.00, f"Checking balance should be $5000, got ${checking['balance']}"
        assert savings["balance"] == 10000.00, f"Savings balance should be $10000, got ${savings['balance']}"
        
        print("✓ Default account balances verified")


class TestTransfers:
    """Transfer endpoint tests"""
    
    def test_01_create_transfer(self):
        """Test creating a transfer"""
        # Get accounts first
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        accounts = response.json()
        from_account = accounts[0]
        to_account = accounts[1]
        
        transfer_amount = 100.00
        initial_balance = from_account["balance"]
        
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": from_account["id"],
                "to_account_number": to_account["account_number"],
                "amount": transfer_amount,
                "description": "Test transfer",
                "recipient_name": "Test Recipient"
            }
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        transaction = response.json()
        assert transaction["amount"] == transfer_amount
        assert transaction["transaction_type"] == "transfer"
        assert transaction["description"] == "Test transfer"
        
        print(f"✓ Transfer created: ${transfer_amount:.2f}")
        
        # Verify balance was deducted
        response = requests.get(
            f"{BASE_URL}/api/accounts/{from_account['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        updated_account = response.json()
        expected_balance = initial_balance - transfer_amount
        
        assert updated_account["balance"] == expected_balance, \
            f"Balance should be ${expected_balance:.2f}, got ${updated_account['balance']:.2f}"
        
        print(f"✓ Balance updated correctly: ${updated_account['balance']:.2f}")
    
    def test_02_transfer_insufficient_funds(self):
        """Test transfer with insufficient funds fails"""
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        accounts = response.json()
        from_account = accounts[0]
        
        # Try to transfer more than available balance
        excessive_amount = from_account["balance"] + 1000.00
        
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": from_account["id"],
                "to_account_number": "1234567890",
                "amount": excessive_amount,
                "description": "Should fail"
            }
        )
        
        assert response.status_code == 400, "Should fail with insufficient funds"
        assert "insufficient" in response.json()["detail"].lower()
        
        print("✓ Insufficient funds transfer correctly rejected")
    
    def test_03_transfer_invalid_account(self):
        """Test transfer from non-existent account fails"""
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": "invalid-account-id",
                "to_account_number": "1234567890",
                "amount": 50.00,
                "description": "Should fail"
            }
        )
        
        assert response.status_code == 404, "Should fail with invalid account"
        print("✓ Invalid account transfer correctly rejected")


class TestTransactions:
    """Transaction endpoint tests"""
    
    def test_01_get_transactions(self):
        """Test getting user transactions"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        
        transactions = response.json()
        assert isinstance(transactions, list), "Transactions should be a list"
        assert len(transactions) > 0, "Should have at least one transaction (initial deposit)"
        
        # Verify transaction structure
        for txn in transactions:
            assert "id" in txn
            assert "amount" in txn
            assert "transaction_type" in txn
            assert "timestamp" in txn
        
        print(f"✓ Retrieved {len(transactions)} transactions")


class TestDashboard:
    """Dashboard stats endpoint tests"""
    
    def test_01_get_dashboard_stats(self):
        """Test getting dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get dashboard stats failed: {response.text}"
        
        stats = response.json()
        assert "total_balance" in stats
        assert "monthly_spending" in stats
        assert "accounts_count" in stats
        assert "recent_transactions" in stats
        
        assert stats["accounts_count"] >= 2, "Should have at least 2 accounts"
        assert stats["total_balance"] > 0, "Total balance should be positive"
        assert isinstance(stats["recent_transactions"], list), "Recent transactions should be a list"
        
        print(f"✓ Dashboard stats retrieved:")
        print(f"  - Total balance: ${stats['total_balance']:.2f}")
        print(f"  - Monthly spending: ${stats['monthly_spending']:.2f}")
        print(f"  - Accounts: {stats['accounts_count']}")
        print(f"  - Recent transactions: {len(stats['recent_transactions'])}")


class TestBillers:
    """Biller endpoint tests"""
    
    def test_01_get_billers(self):
        """Test getting list of billers"""
        response = requests.get(f"{BASE_URL}/api/billers")
        
        assert response.status_code == 200, f"Get billers failed: {response.text}"
        
        billers = response.json()
        assert isinstance(billers, list), "Billers should be a list"
        assert len(billers) > 0, "Should have at least one biller"
        
        # Verify biller structure
        for biller in billers:
            assert "id" in biller
            assert "name" in biller
            assert "category" in biller
            assert "account_number" in biller
        
        print(f"✓ Retrieved {len(billers)} billers")


# Pytest configuration
@pytest.fixture(scope="session", autouse=True)
def setup_test_session():
    """Setup before all tests"""
    print("\n" + "="*60)
    print("HSBC Bank App - Backend API Tests")
    print("="*60)
    yield
    print("\n" + "="*60)
    print("Backend API Tests Complete")
    print("="*60)
