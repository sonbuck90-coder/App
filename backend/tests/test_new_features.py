"""
Backend API Tests for New Features: Payees Management, Analytics, AI Chat
Tests: POST/PUT /api/payees, GET /api/analytics/spending, POST /api/chat, GET /api/chat/history
"""
import pytest
import requests
import os
import uuid
import time

# Get backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL environment variable not set")

# Test user credentials
TEST_EMAIL = "sorttest@test.com"
TEST_PASSWORD = "Test123!"

# Global variables
auth_token = None
user_id = None
account_id = None
created_payee_id = None


class TestPayeesManagement:
    """Payees Management CRUD tests"""
    
    def test_01_login(self):
        """Login with test user"""
        global auth_token, user_id
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        auth_token = data["access_token"]
        user_id = data["user"]["id"]
        
        print(f"✓ Logged in as {TEST_EMAIL}")
    
    def test_02_get_accounts(self):
        """Get user accounts"""
        global account_id
        
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) > 0
        account_id = accounts[0]["id"]
        
        print(f"✓ Retrieved {len(accounts)} accounts")
    
    def test_03_create_payee(self):
        """Test POST /api/payees - Create new payee"""
        global created_payee_id
        
        payee_data = {
            "name": f"TEST_Payee_{uuid.uuid4().hex[:6]}",
            "sort_code": "40-12-34",
            "account_number": f"1234567{uuid.uuid4().hex[:3]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=payee_data
        )
        
        assert response.status_code == 200, f"Create payee failed: {response.text}"
        
        payee = response.json()
        assert "id" in payee
        assert payee["name"] == payee_data["name"]
        assert payee["sort_code"] == payee_data["sort_code"]
        assert payee["account_number"] == payee_data["account_number"]
        assert payee["user_id"] == user_id
        assert "_id" not in payee, "MongoDB _id should be excluded"
        
        created_payee_id = payee["id"]
        
        print(f"✓ Payee created: {payee['name']}")
        print(f"✓ Payee ID: {created_payee_id}")
        
        # Verify payee appears in GET /api/payees
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        payees = response.json()
        created = next((p for p in payees if p["id"] == created_payee_id), None)
        assert created is not None, "Created payee should appear in payees list"
        
        print(f"✓ Payee verified in GET /api/payees")
    
    def test_04_create_duplicate_payee(self):
        """Test POST /api/payees with duplicate account number fails"""
        # Get existing payee
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees = response.json()
        existing = payees[0]
        
        # Try to create duplicate
        response = requests.post(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": "Duplicate Test",
                "sort_code": existing["sort_code"],
                "account_number": existing["account_number"]
            }
        )
        
        assert response.status_code == 400, "Should fail with duplicate account number"
        assert "already exists" in response.json()["detail"].lower()
        
        print("✓ Duplicate payee creation correctly rejected")
    
    def test_05_update_payee(self):
        """Test PUT /api/payees/{id} - Update payee"""
        updated_name = f"TEST_Updated_{uuid.uuid4().hex[:6]}"
        updated_sort_code = "20-12-34"
        
        response = requests.put(
            f"{BASE_URL}/api/payees/{created_payee_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": updated_name,
                "sort_code": updated_sort_code
            }
        )
        
        assert response.status_code == 200, f"Update payee failed: {response.text}"
        
        updated = response.json()
        assert updated["name"] == updated_name
        assert updated["sort_code"] == updated_sort_code
        assert "_id" not in updated
        
        print(f"✓ Payee updated: {updated['name']}")
        
        # Verify update persisted
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees = response.json()
        verified = next((p for p in payees if p["id"] == created_payee_id), None)
        assert verified is not None
        assert verified["name"] == updated_name
        assert verified["sort_code"] == updated_sort_code
        
        print(f"✓ Update verified in GET /api/payees")
    
    def test_06_update_nonexistent_payee(self):
        """Test PUT /api/payees/{id} with non-existent ID returns 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/payees/{fake_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": "Should Fail"}
        )
        
        assert response.status_code == 404, "Should return 404 for non-existent payee"
        assert "not found" in response.json()["detail"].lower()
        
        print("✓ Update non-existent payee correctly returns 404")
    
    def test_07_update_payee_no_fields(self):
        """Test PUT /api/payees/{id} with no fields returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/payees/{created_payee_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        
        assert response.status_code == 400, "Should return 400 when no fields to update"
        assert "no fields" in response.json()["detail"].lower()
        
        print("✓ Update with no fields correctly returns 400")
    
    def test_08_create_payee_unauthorized(self):
        """Test POST /api/payees without auth fails"""
        response = requests.post(
            f"{BASE_URL}/api/payees",
            json={"name": "Test", "sort_code": "12-34-56", "account_number": "12345678"}
        )
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized payee creation correctly rejected")
    
    def test_09_update_payee_unauthorized(self):
        """Test PUT /api/payees/{id} without auth fails"""
        response = requests.put(
            f"{BASE_URL}/api/payees/{created_payee_id}",
            json={"name": "Test"}
        )
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized payee update correctly rejected")


class TestSpendingAnalytics:
    """Spending Analytics tests"""
    
    def test_01_get_spending_analytics(self):
        """Test GET /api/analytics/spending"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/spending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get analytics failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "total_spending" in data
        assert "transaction_count" in data
        assert "categories" in data
        assert "top_payees" in data
        assert "monthly_trend" in data
        
        assert isinstance(data["total_spending"], (int, float))
        assert isinstance(data["transaction_count"], int)
        assert isinstance(data["categories"], list)
        assert isinstance(data["top_payees"], list)
        assert isinstance(data["monthly_trend"], list)
        
        print(f"✓ Analytics retrieved successfully")
        print(f"  - Total spending: ${data['total_spending']:.2f}")
        print(f"  - Transaction count: {data['transaction_count']}")
        print(f"  - Categories: {len(data['categories'])}")
        print(f"  - Top payees: {len(data['top_payees'])}")
        print(f"  - Monthly trend: {len(data['monthly_trend'])} months")
        
        # Verify category structure
        if len(data["categories"]) > 0:
            cat = data["categories"][0]
            assert "name" in cat
            assert "total" in cat
            assert "count" in cat
            print(f"✓ Category structure verified: {cat['name']} - ${cat['total']:.2f} ({cat['count']} txns)")
        
        # Verify top payees structure
        if len(data["top_payees"]) > 0:
            payee = data["top_payees"][0]
            assert "name" in payee
            assert "total" in payee
            print(f"✓ Top payee structure verified: {payee['name']} - ${payee['total']:.2f}")
        
        # Verify monthly trend structure
        if len(data["monthly_trend"]) > 0:
            month = data["monthly_trend"][0]
            assert "month" in month
            assert "year" in month
            assert "total" in month
            assert "count" in month
            print(f"✓ Monthly trend structure verified: {month['month']} {month['year']} - ${month['total']:.2f}")
    
    def test_02_analytics_unauthorized(self):
        """Test GET /api/analytics/spending without auth fails"""
        response = requests.get(f"{BASE_URL}/api/analytics/spending")
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized analytics access correctly rejected")
    
    def test_03_analytics_with_transactions(self):
        """Test analytics after creating a transaction"""
        # Create a transfer to generate transaction data
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "to_account_number": "9999999999",
                "amount": 50.00,
                "description": "Test for analytics",
                "recipient_name": "Analytics Test Recipient"
            }
        )
        
        assert response.status_code == 200
        print("✓ Test transaction created")
        
        time.sleep(0.5)
        
        # Get analytics
        response = requests.get(
            f"{BASE_URL}/api/analytics/spending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify transaction is reflected
        assert data["transaction_count"] > 0, "Should have at least one transaction"
        assert data["total_spending"] >= 50.00, "Total spending should include test transaction"
        
        print(f"✓ Analytics reflects new transaction")


class TestAIChat:
    """AI Chat tests"""
    
    def test_01_send_chat_message(self):
        """Test POST /api/chat - Send message to AI"""
        message = "What is my total balance?"
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": message}
        )
        
        assert response.status_code == 200, f"Chat failed: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 0, "AI response should not be empty"
        assert isinstance(data["session_id"], str)
        
        print(f"✓ Chat message sent successfully")
        print(f"✓ Session ID: {data['session_id']}")
        print(f"✓ AI Response: {data['response'][:100]}...")
        
        # Store session_id for next test
        global chat_session_id
        chat_session_id = data["session_id"]
    
    def test_02_chat_with_session_id(self):
        """Test POST /api/chat with existing session_id"""
        message = "What was my last transaction?"
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": message, "session_id": chat_session_id}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["session_id"] == chat_session_id, "Session ID should be preserved"
        assert len(data["response"]) > 0
        
        print(f"✓ Chat with session ID successful")
        print(f"✓ AI Response: {data['response'][:100]}...")
    
    def test_03_get_chat_history(self):
        """Test GET /api/chat/history"""
        response = requests.get(
            f"{BASE_URL}/api/chat/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get chat history failed: {response.text}"
        
        messages = response.json()
        assert isinstance(messages, list)
        assert len(messages) >= 4, "Should have at least 4 messages (2 user + 2 assistant)"
        
        # Verify message structure
        for msg in messages:
            assert "user_id" in msg
            assert "session_id" in msg
            assert "role" in msg
            assert "content" in msg
            assert "timestamp" in msg
            assert msg["role"] in ["user", "assistant"]
            assert "_id" not in msg, "MongoDB _id should be excluded"
        
        print(f"✓ Chat history retrieved: {len(messages)} messages")
        
        # Verify our messages are in history
        user_messages = [m for m in messages if m["role"] == "user"]
        assert len(user_messages) >= 2, "Should have at least 2 user messages"
        
        print(f"✓ User messages: {len(user_messages)}")
        print(f"✓ Assistant messages: {len([m for m in messages if m['role'] == 'assistant'])}")
    
    def test_04_get_chat_history_by_session(self):
        """Test GET /api/chat/history with session_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/chat/history?session_id={chat_session_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        messages = response.json()
        assert isinstance(messages, list)
        
        # All messages should have the same session_id
        for msg in messages:
            assert msg["session_id"] == chat_session_id
        
        print(f"✓ Chat history filtered by session: {len(messages)} messages")
    
    def test_05_chat_unauthorized(self):
        """Test POST /api/chat without auth fails"""
        response = requests.post(
            f"{BASE_URL}/api/chat",
            json={"message": "Test"}
        )
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized chat access correctly rejected")
    
    def test_06_chat_history_unauthorized(self):
        """Test GET /api/chat/history without auth fails"""
        response = requests.get(f"{BASE_URL}/api/chat/history")
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized chat history access correctly rejected")
    
    def test_07_chat_quick_action_last_transaction(self):
        """Test chat with 'Last Transaction' quick action query"""
        message = "What was my last transaction? Give me full details including amount, date, and recipient."
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": message}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # AI should provide transaction details
        response_text = data["response"].lower()
        assert len(data["response"]) > 50, "Response should be detailed"
        
        print(f"✓ Last Transaction query successful")
        print(f"✓ Response length: {len(data['response'])} chars")
    
    def test_08_chat_quick_action_transfer_delays(self):
        """Test chat with 'Transfer Delays' quick action query"""
        message = "What are the typical transfer processing times and any potential delays I should know about?"
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": message}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        response_text = data["response"].lower()
        # Should mention business days or processing times
        assert any(keyword in response_text for keyword in ["day", "business", "transfer", "time"]), \
            "Response should mention transfer timing"
        
        print(f"✓ Transfer Delays query successful")
    
    def test_09_chat_quick_action_support_hours(self):
        """Test chat with 'Support Hours' quick action query"""
        message = "What are HSBC support hours and how can I contact customer service?"
        
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": message}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        response_text = data["response"].lower()
        # Should mention hours or contact info
        assert any(keyword in response_text for keyword in ["hour", "support", "contact", "phone", "chat"]), \
            "Response should mention support hours or contact methods"
        
        print(f"✓ Support Hours query successful")


# Pytest configuration
@pytest.fixture(scope="session", autouse=True)
def setup_test_session():
    """Setup before all tests"""
    print("\n" + "="*70)
    print("New Features Tests: Payees Management, Analytics, AI Chat")
    print("="*70)
    yield
    print("\n" + "="*70)
    print("New Features Backend Tests Complete")
    print("="*70)
