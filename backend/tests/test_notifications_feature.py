"""
Backend API Tests for Notifications Feature
Tests: Notification creation on transfers/bills/cards/registration, GET /api/notifications, 
GET /api/notifications/unread-count, POST /api/notifications/{id}/read, POST /api/notifications/read-all
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
card_id = None
notification_id = None


class TestNotificationCreation:
    """Test that notifications are created on various actions"""
    
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
    
    def test_02_get_accounts_and_cards(self):
        """Get user accounts and cards for testing"""
        global account_id, card_id
        
        # Get accounts
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) > 0
        account_id = accounts[0]["id"]
        
        print(f"✓ Retrieved {len(accounts)} accounts")
        
        # Get cards
        response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        cards = response.json()
        assert len(cards) > 0
        card_id = cards[0]["id"]
        
        print(f"✓ Retrieved {len(cards)} cards")
    
    def test_03_transfer_creates_notification(self):
        """Test POST /api/transfers creates a notification"""
        # Get initial notification count
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        initial_count = len(response.json())
        
        # Create transfer
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "to_account_number": "9999999999",
                "amount": 25.00,
                "description": "Test transfer for notification",
                "recipient_name": "Notification Test Recipient"
            }
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        print("✓ Transfer created successfully")
        
        time.sleep(0.5)
        
        # Check notifications increased
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) > initial_count, "Notification count should increase after transfer"
        
        # Find the transfer notification
        transfer_notif = next((n for n in notifications if n["notification_type"] == "transfer"), None)
        assert transfer_notif is not None, "Transfer notification should exist"
        assert "Transfer Sent" in transfer_notif["title"]
        assert "$25.00" in transfer_notif["body"]
        assert "Notification Test Recipient" in transfer_notif["body"]
        
        print(f"✓ Transfer notification created: {transfer_notif['title']}")
    
    def test_04_bill_payment_creates_notification(self):
        """Test POST /api/bills/pay creates a notification"""
        # Get initial notification count
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        initial_count = len(response.json())
        
        # Pay bill
        response = requests.post(
            f"{BASE_URL}/api/bills/pay",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "biller_id": "1",  # Electric Company
                "amount": 75.50,
                "reference": "Test bill payment"
            }
        )
        
        assert response.status_code == 200, f"Bill payment failed: {response.text}"
        print("✓ Bill payment created successfully")
        
        time.sleep(0.5)
        
        # Check notifications increased
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) > initial_count, "Notification count should increase after bill payment"
        
        # Find the payment notification
        payment_notif = next((n for n in notifications if n["notification_type"] == "payment"), None)
        assert payment_notif is not None, "Payment notification should exist"
        assert "Bill Payment" in payment_notif["title"]
        assert "$75.50" in payment_notif["body"]
        assert "Electric Company" in payment_notif["body"]
        
        print(f"✓ Bill payment notification created: {payment_notif['title']}")
    
    def test_05_card_freeze_creates_notification(self):
        """Test POST /api/cards/{id}/freeze creates a notification"""
        # Get initial notification count
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        initial_count = len(response.json())
        
        # Freeze card
        response = requests.post(
            f"{BASE_URL}/api/cards/{card_id}/freeze",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Card freeze failed: {response.text}"
        print("✓ Card frozen successfully")
        
        time.sleep(0.5)
        
        # Check notifications increased
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) > initial_count, "Notification count should increase after card freeze"
        
        # Find the card notification
        card_notif = next((n for n in notifications if n["notification_type"] == "card" and "Frozen" in n["title"]), None)
        assert card_notif is not None, "Card freeze notification should exist"
        assert "Card Frozen" in card_notif["title"]
        assert "frozen" in card_notif["body"].lower()
        
        print(f"✓ Card freeze notification created: {card_notif['title']}")
    
    def test_06_card_unfreeze_creates_notification(self):
        """Test POST /api/cards/{id}/unfreeze creates a notification"""
        # Get initial notification count
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        initial_count = len(response.json())
        
        # Unfreeze card
        response = requests.post(
            f"{BASE_URL}/api/cards/{card_id}/unfreeze",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Card unfreeze failed: {response.text}"
        print("✓ Card unfrozen successfully")
        
        time.sleep(0.5)
        
        # Check notifications increased
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) > initial_count, "Notification count should increase after card unfreeze"
        
        # Find the card notification
        card_notif = next((n for n in notifications if n["notification_type"] == "card" and "Activated" in n["title"]), None)
        assert card_notif is not None, "Card unfreeze notification should exist"
        assert "Card Activated" in card_notif["title"]
        assert "unfrozen" in card_notif["body"].lower() or "active" in card_notif["body"].lower()
        
        print(f"✓ Card unfreeze notification created: {card_notif['title']}")
    
    def test_07_registration_creates_welcome_notification(self):
        """Test that registration creates a welcome notification"""
        # Register new user
        new_email = f"test_notif_{uuid.uuid4().hex[:8]}@hsbc.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": new_email,
                "password": "Test123!",
                "name": "Notification Test User"
            }
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        new_token = response.json()["access_token"]
        print(f"✓ New user registered: {new_email}")
        
        time.sleep(0.5)
        
        # Check for welcome notification
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {new_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) > 0, "New user should have at least one notification"
        
        # Find welcome notification
        welcome_notif = next((n for n in notifications if n["notification_type"] == "welcome"), None)
        assert welcome_notif is not None, "Welcome notification should exist"
        assert "Welcome" in welcome_notif["title"]
        assert "HSBC" in welcome_notif["title"]
        
        print(f"✓ Welcome notification created: {welcome_notif['title']}")


class TestNotificationEndpoints:
    """Test notification CRUD endpoints"""
    
    def test_01_get_notifications(self):
        """Test GET /api/notifications returns notification list"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        
        notifications = response.json()
        assert isinstance(notifications, list), "Notifications should be a list"
        assert len(notifications) > 0, "Should have at least one notification"
        
        # Verify notification structure
        for notif in notifications:
            assert "id" in notif
            assert "user_id" in notif
            assert "title" in notif
            assert "body" in notif
            assert "notification_type" in notif
            assert "is_read" in notif
            assert "timestamp" in notif
            assert "_id" not in notif, "MongoDB _id should be excluded"
            assert notif["notification_type"] in ["transfer", "payment", "card", "welcome", "system"]
        
        print(f"✓ Retrieved {len(notifications)} notifications")
        
        # Store first notification ID for later tests
        global notification_id
        notification_id = notifications[0]["id"]
    
    def test_02_notifications_sorted_by_timestamp_desc(self):
        """Test GET /api/notifications returns notifications sorted by timestamp desc"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        
        if len(notifications) > 1:
            # Verify descending order (newest first)
            for i in range(len(notifications) - 1):
                current_time = notifications[i]["timestamp"]
                next_time = notifications[i + 1]["timestamp"]
                assert current_time >= next_time, "Notifications should be sorted by timestamp descending"
            
            print("✓ Notifications correctly sorted by timestamp (newest first)")
        else:
            print("✓ Only one notification, sorting not applicable")
    
    def test_03_get_notifications_with_limit(self):
        """Test GET /api/notifications with limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/notifications?limit=2",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) <= 2, "Should respect limit parameter"
        
        print(f"✓ Limit parameter working: returned {len(notifications)} notifications")
    
    def test_04_get_unread_count(self):
        """Test GET /api/notifications/unread-count returns correct count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        
        data = response.json()
        assert "count" in data, "Response should have 'count' field"
        assert isinstance(data["count"], int), "Count should be an integer"
        assert data["count"] >= 0, "Count should be non-negative"
        
        print(f"✓ Unread count retrieved: {data['count']}")
        
        # Verify count matches actual unread notifications
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        notifications = response.json()
        actual_unread = len([n for n in notifications if not n["is_read"]])
        
        assert data["count"] == actual_unread, f"Unread count ({data['count']}) should match actual unread notifications ({actual_unread})"
        print(f"✓ Unread count matches actual unread notifications: {actual_unread}")
    
    def test_05_mark_notification_read(self):
        """Test POST /api/notifications/{id}/read marks notification as read"""
        # Get an unread notification
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        notifications = response.json()
        unread_notif = next((n for n in notifications if not n["is_read"]), None)
        
        if unread_notif is None:
            pytest.skip("No unread notifications available for testing")
        
        notif_id = unread_notif["id"]
        
        # Mark as read
        response = requests.post(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        
        print(f"✓ Notification marked as read: {notif_id}")
        
        # Verify notification is now read
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        notifications = response.json()
        marked_notif = next((n for n in notifications if n["id"] == notif_id), None)
        
        assert marked_notif is not None, "Notification should still exist"
        assert marked_notif["is_read"] == True, "Notification should be marked as read"
        
        print(f"✓ Verified notification is_read = True")
    
    def test_06_mark_all_read(self):
        """Test POST /api/notifications/read-all marks all notifications as read"""
        # Get initial unread count
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        initial_unread = response.json()["count"]
        
        # Mark all as read
        response = requests.post(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Mark all read failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        
        print(f"✓ All notifications marked as read")
        
        # Verify unread count is now 0
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0, "Unread count should be 0 after mark all read"
        
        print(f"✓ Verified unread count is now 0 (was {initial_unread})")
        
        # Verify all notifications are read
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        notifications = response.json()
        
        for notif in notifications:
            assert notif["is_read"] == True, f"All notifications should be read, but {notif['id']} is not"
        
        print(f"✓ Verified all {len(notifications)} notifications are marked as read")
    
    def test_07_notifications_unauthorized(self):
        """Test GET /api/notifications without auth fails"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized notifications access correctly rejected")
    
    def test_08_unread_count_unauthorized(self):
        """Test GET /api/notifications/unread-count without auth fails"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized unread count access correctly rejected")
    
    def test_09_mark_read_unauthorized(self):
        """Test POST /api/notifications/{id}/read without auth fails"""
        response = requests.post(f"{BASE_URL}/api/notifications/{notification_id}/read")
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized mark read correctly rejected")
    
    def test_10_mark_all_read_unauthorized(self):
        """Test POST /api/notifications/read-all without auth fails"""
        response = requests.post(f"{BASE_URL}/api/notifications/read-all")
        
        assert response.status_code == 403, "Should fail without auth"
        print("✓ Unauthorized mark all read correctly rejected")


# Pytest configuration
@pytest.fixture(scope="session", autouse=True)
def setup_test_session():
    """Setup before all tests"""
    print("\n" + "="*70)
    print("Notifications Feature Tests")
    print("="*70)
    yield
    print("\n" + "="*70)
    print("Notifications Backend Tests Complete")
    print("="*70)
