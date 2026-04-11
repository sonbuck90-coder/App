#!/usr/bin/env python3
"""
VaultBank Backend API Testing Suite
Tests all backend APIs for the VaultBank application
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://vault-app-25.preview.emergentagent.com/api"
TEST_EMAIL = "test@vaultbank.com"
TEST_PASSWORD = "Test123!"

class VaultBankAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        self.accounts = []
        self.cards = []
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }

    def log_result(self, test_name: str, success: bool, message: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        
        if success:
            self.test_results["passed"] += 1
        else:
            self.test_results["failed"] += 1
            self.test_results["errors"].append({
                "test": test_name,
                "message": message,
                "response": response_data
            })
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, auth_required: bool = False) -> tuple:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth_required and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response.status_code, response.json() if response.content else {}
        except requests.exceptions.RequestException as e:
            return 0, {"error": str(e)}
        except json.JSONDecodeError:
            return response.status_code, {"error": "Invalid JSON response"}

    def test_user_registration(self):
        """Test user registration API"""
        print("🔐 Testing User Registration API...")
        
        # Test with valid data
        registration_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User"
        }
        
        status_code, response = self.make_request("POST", "/auth/register", registration_data)
        
        if status_code == 201 or status_code == 200:
            if "access_token" in response and "user" in response:
                self.auth_token = response["access_token"]
                self.user_data = response["user"]
                self.log_result("User Registration", True, f"User registered successfully with ID: {self.user_data.get('id')}")
            else:
                self.log_result("User Registration", False, "Missing access_token or user in response", response)
        elif status_code == 400 and "already registered" in str(response):
            # User already exists, try to login instead
            self.log_result("User Registration", True, "User already exists (expected for testing)")
            self.test_user_login()
        else:
            self.log_result("User Registration", False, f"Status: {status_code}", response)

    def test_user_login(self):
        """Test user login API"""
        print("🔑 Testing User Login API...")
        
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        status_code, response = self.make_request("POST", "/auth/login", login_data)
        
        if status_code == 200:
            if "access_token" in response and "user" in response:
                self.auth_token = response["access_token"]
                self.user_data = response["user"]
                self.log_result("User Login", True, f"Login successful for user: {self.user_data.get('email')}")
            else:
                self.log_result("User Login", False, "Missing access_token or user in response", response)
        else:
            self.log_result("User Login", False, f"Status: {status_code}", response)

    def test_get_current_user(self):
        """Test get current user API"""
        print("👤 Testing Get Current User API...")
        
        status_code, response = self.make_request("GET", "/auth/me", auth_required=True)
        
        if status_code == 200:
            if "id" in response and "email" in response:
                self.log_result("Get Current User", True, f"Retrieved user: {response.get('email')}")
            else:
                self.log_result("Get Current User", False, "Missing user data in response", response)
        else:
            self.log_result("Get Current User", False, f"Status: {status_code}", response)

    def test_get_accounts(self):
        """Test get accounts API"""
        print("🏦 Testing Get Accounts API...")
        
        status_code, response = self.make_request("GET", "/accounts", auth_required=True)
        
        if status_code == 200:
            if isinstance(response, list) and len(response) > 0:
                self.accounts = response
                account_types = [acc.get('account_type') for acc in response]
                balances = [acc.get('balance') for acc in response]
                self.log_result("Get Accounts", True, f"Retrieved {len(response)} accounts: {account_types}, Balances: {balances}")
            else:
                self.log_result("Get Accounts", False, "No accounts found or invalid response format", response)
        else:
            self.log_result("Get Accounts", False, f"Status: {status_code}", response)

    def test_get_specific_account(self):
        """Test get specific account API"""
        print("🏦 Testing Get Specific Account API...")
        
        if not self.accounts:
            self.log_result("Get Specific Account", False, "No accounts available for testing")
            return
        
        account_id = self.accounts[0].get('id')
        status_code, response = self.make_request("GET", f"/accounts/{account_id}", auth_required=True)
        
        if status_code == 200:
            if "id" in response and response["id"] == account_id:
                self.log_result("Get Specific Account", True, f"Retrieved account: {response.get('account_type')} with balance: {response.get('balance')}")
            else:
                self.log_result("Get Specific Account", False, "Account ID mismatch", response)
        else:
            self.log_result("Get Specific Account", False, f"Status: {status_code}", response)

    def test_get_transactions(self):
        """Test get transactions API"""
        print("💳 Testing Get Transactions API...")
        
        status_code, response = self.make_request("GET", "/transactions", auth_required=True)
        
        if status_code == 200:
            if isinstance(response, list):
                self.log_result("Get Transactions", True, f"Retrieved {len(response)} transactions")
                if len(response) > 0:
                    print(f"   Sample transaction: {response[0].get('description')} - ${response[0].get('amount')}")
            else:
                self.log_result("Get Transactions", False, "Invalid response format", response)
        else:
            self.log_result("Get Transactions", False, f"Status: {status_code}", response)

    def test_create_transfer(self):
        """Test create transfer API"""
        print("💸 Testing Create Transfer API...")
        
        if not self.accounts or len(self.accounts) < 1:
            self.log_result("Create Transfer", False, "No accounts available for testing")
            return
        
        # Use first account as source
        from_account = self.accounts[0]
        
        transfer_data = {
            "from_account_id": from_account.get('id'),
            "to_account_number": "1234567890",  # External account
            "amount": 100.0,
            "description": "Test transfer",
            "recipient_name": "Test Recipient"
        }
        
        status_code, response = self.make_request("POST", "/transfers", transfer_data, auth_required=True)
        
        if status_code == 200 or status_code == 201:
            if "id" in response and response.get("amount") == 100.0:
                self.log_result("Create Transfer", True, f"Transfer created: ${response.get('amount')} to {response.get('recipient_name')}")
            else:
                self.log_result("Create Transfer", False, "Invalid transfer response", response)
        else:
            self.log_result("Create Transfer", False, f"Status: {status_code}", response)

    def test_get_billers(self):
        """Test get billers API"""
        print("🧾 Testing Get Billers API...")
        
        status_code, response = self.make_request("GET", "/billers")
        
        if status_code == 200:
            if isinstance(response, list) and len(response) > 0:
                biller_names = [biller.get('name') for biller in response]
                self.log_result("Get Billers", True, f"Retrieved {len(response)} billers: {biller_names[:3]}...")
            else:
                self.log_result("Get Billers", False, "No billers found or invalid format", response)
        else:
            self.log_result("Get Billers", False, f"Status: {status_code}", response)

    def test_pay_bill(self):
        """Test pay bill API"""
        print("💰 Testing Pay Bill API...")
        
        if not self.accounts:
            self.log_result("Pay Bill", False, "No accounts available for testing")
            return
        
        payment_data = {
            "from_account_id": self.accounts[0].get('id'),
            "biller_id": "1",  # Electric Company
            "amount": 50.0,
            "reference": "Test payment"
        }
        
        status_code, response = self.make_request("POST", "/bills/pay", payment_data, auth_required=True)
        
        if status_code == 200 or status_code == 201:
            if "id" in response and response.get("amount") == 50.0:
                self.log_result("Pay Bill", True, f"Bill payment successful: ${response.get('amount')} to {response.get('recipient_name')}")
            else:
                self.log_result("Pay Bill", False, "Invalid payment response", response)
        else:
            self.log_result("Pay Bill", False, f"Status: {status_code}", response)

    def test_get_cards(self):
        """Test get cards API"""
        print("💳 Testing Get Cards API...")
        
        status_code, response = self.make_request("GET", "/cards", auth_required=True)
        
        if status_code == 200:
            if isinstance(response, list) and len(response) > 0:
                self.cards = response
                card_types = [card.get('card_type') for card in response]
                self.log_result("Get Cards", True, f"Retrieved {len(response)} cards: {card_types}")
            else:
                self.log_result("Get Cards", False, "No cards found or invalid format", response)
        else:
            self.log_result("Get Cards", False, f"Status: {status_code}", response)

    def test_freeze_unfreeze_card(self):
        """Test freeze and unfreeze card APIs"""
        print("🧊 Testing Freeze/Unfreeze Card APIs...")
        
        if not self.cards:
            self.log_result("Freeze/Unfreeze Card", False, "No cards available for testing")
            return
        
        card_id = self.cards[0].get('id')
        
        # Test freeze
        status_code, response = self.make_request("POST", f"/cards/{card_id}/freeze", auth_required=True)
        
        if status_code == 200:
            self.log_result("Freeze Card", True, "Card frozen successfully")
            
            # Test unfreeze
            status_code, response = self.make_request("POST", f"/cards/{card_id}/unfreeze", auth_required=True)
            
            if status_code == 200:
                self.log_result("Unfreeze Card", True, "Card unfrozen successfully")
            else:
                self.log_result("Unfreeze Card", False, f"Status: {status_code}", response)
        else:
            self.log_result("Freeze Card", False, f"Status: {status_code}", response)

    def test_dashboard_stats(self):
        """Test dashboard stats API"""
        print("📊 Testing Dashboard Stats API...")
        
        status_code, response = self.make_request("GET", "/dashboard/stats", auth_required=True)
        
        if status_code == 200:
            required_fields = ["total_balance", "monthly_spending", "accounts_count", "recent_transactions"]
            if all(field in response for field in required_fields):
                self.log_result("Dashboard Stats", True, 
                    f"Stats retrieved - Balance: ${response.get('total_balance')}, "
                    f"Monthly Spending: ${response.get('monthly_spending')}, "
                    f"Accounts: {response.get('accounts_count')}")
            else:
                missing_fields = [field for field in required_fields if field not in response]
                self.log_result("Dashboard Stats", False, f"Missing fields: {missing_fields}", response)
        else:
            self.log_result("Dashboard Stats", False, f"Status: {status_code}", response)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting VaultBank Backend API Tests")
        print("=" * 50)
        
        # Authentication tests
        self.test_user_registration()
        if not self.auth_token:
            self.test_user_login()
        
        if not self.auth_token:
            print("❌ Cannot proceed with authenticated tests - no auth token")
            return
        
        # Authenticated tests
        self.test_get_current_user()
        self.test_get_accounts()
        self.test_get_specific_account()
        self.test_get_transactions()
        self.test_create_transfer()
        self.test_get_billers()
        self.test_pay_bill()
        self.test_get_cards()
        self.test_freeze_unfreeze_card()
        self.test_dashboard_stats()
        
        # Summary
        print("=" * 50)
        print("🏁 Test Summary")
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🔍 Failed Tests Details:")
            for error in self.test_results['errors']:
                print(f"   • {error['test']}: {error['message']}")
        
        return self.test_results['failed'] == 0

if __name__ == "__main__":
    tester = VaultBankAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)