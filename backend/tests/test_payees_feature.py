"""
Backend API Tests for Recent Payees Feature
Tests: POST /api/transfers saves payee, GET /api/payees, DELETE /api/payees, duplicate handling
"""
import pytest
import requests
import os
import uuid
import time

# Get backend URL from environment
BASE_URL = "https://vault-app-25.preview.emergentagent.com"

# Test user credentials - use the existing test user with payees
TEST_EMAIL = "sorttest@test.com"
TEST_PASSWORD = "Test123!"

# Global variables
auth_token = None
user_id = None
account_id = None
payee_ids = []


class TestPayeesFeature:
    """Recent Payees feature tests"""
    
    def test_01_login_test_user(self):
        """Login with test user that has existing payees"""
        global auth_token, user_id
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        
        auth_token = data["access_token"]
        user_id = data["user"]["id"]
        
        print(f"✓ Logged in as {TEST_EMAIL}")
        print(f"✓ User ID: {user_id}")
    
    def test_02_get_accounts(self):
        """Get user accounts for transfer tests"""
        global account_id
        
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get accounts failed: {response.text}"
        
        accounts = response.json()
        assert len(accounts) > 0, "User should have at least one account"
        
        account_id = accounts[0]["id"]
        print(f"✓ Retrieved {len(accounts)} accounts")
        print(f"✓ Using account ID: {account_id}")
    
    def test_03_get_existing_payees(self):
        """Get existing payees (should have John Smith and Jane Doe)"""
        global payee_ids
        
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Get payees failed: {response.text}"
        
        payees = response.json()
        assert isinstance(payees, list), "Payees should be a list"
        
        print(f"✓ Retrieved {len(payees)} existing payees")
        
        # Verify payee structure
        for payee in payees:
            assert "id" in payee, "Payee should have id"
            assert "user_id" in payee, "Payee should have user_id"
            assert "name" in payee, "Payee should have name"
            assert "sort_code" in payee, "Payee should have sort_code"
            assert "account_number" in payee, "Payee should have account_number"
            assert "last_used" in payee, "Payee should have last_used"
            assert "_id" not in payee, "MongoDB _id should be excluded"
            
            payee_ids.append(payee["id"])
            print(f"  - {payee['name']}: {payee['sort_code']} / {payee['account_number']}")
    
    def test_04_create_transfer_saves_new_payee(self):
        """Test that POST /api/transfers saves a new payee"""
        # Create a transfer to a new recipient
        new_recipient_name = f"TEST_NewPayee_{uuid.uuid4().hex[:6]}"
        new_account_number = f"1234567{uuid.uuid4().hex[:3]}"
        new_sort_code = "40-12-34"
        
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "to_account_number": new_account_number,
                "amount": 50.00,
                "description": "Test transfer for payee creation",
                "recipient_name": new_recipient_name,
                "sort_code": new_sort_code
            }
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        transaction = response.json()
        assert transaction["recipient_name"] == new_recipient_name
        print(f"✓ Transfer created to {new_recipient_name}")
        
        # Verify payee was saved by fetching payees
        time.sleep(0.5)  # Small delay to ensure DB write completes
        
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        payees = response.json()
        
        # Find the new payee
        new_payee = next((p for p in payees if p["name"] == new_recipient_name), None)
        assert new_payee is not None, f"New payee {new_recipient_name} not found in payees list"
        assert new_payee["account_number"] == new_account_number
        assert new_payee["sort_code"] == new_sort_code
        
        payee_ids.append(new_payee["id"])
        print(f"✓ Payee saved successfully: {new_payee['name']}")
        print(f"✓ Payee ID: {new_payee['id']}")
    
    def test_05_duplicate_transfer_updates_existing_payee(self):
        """Test that duplicate transfer to same account updates existing payee instead of creating new"""
        # Get current payees count
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees_before = response.json()
        count_before = len(payees_before)
        
        # Pick an existing payee
        existing_payee = payees_before[0]
        original_name = existing_payee["name"]
        account_number = existing_payee["account_number"]
        sort_code = existing_payee["sort_code"]
        
        # Create transfer to same account but with updated name
        updated_name = f"{original_name}_UPDATED"
        
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "to_account_number": account_number,
                "amount": 25.00,
                "description": "Duplicate transfer test",
                "recipient_name": updated_name,
                "sort_code": sort_code
            }
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        print(f"✓ Duplicate transfer created to {account_number}")
        
        time.sleep(0.5)
        
        # Verify payee was updated, not duplicated
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees_after = response.json()
        count_after = len(payees_after)
        
        assert count_after == count_before, f"Payee count should remain {count_before}, got {count_after}"
        
        # Verify the payee name was updated
        updated_payee = next((p for p in payees_after if p["account_number"] == account_number), None)
        assert updated_payee is not None
        assert updated_payee["name"] == updated_name, f"Payee name should be updated to {updated_name}"
        
        print(f"✓ Existing payee updated (not duplicated)")
        print(f"✓ Name updated: {original_name} → {updated_name}")
    
    def test_06_payees_sorted_by_last_used_descending(self):
        """Test that GET /api/payees returns payees sorted by last_used descending"""
        # Create two transfers with delay to ensure different timestamps
        payee1_name = f"TEST_First_{uuid.uuid4().hex[:6]}"
        payee1_account = f"1111111{uuid.uuid4().hex[:3]}"
        
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "to_account_number": payee1_account,
                "amount": 10.00,
                "recipient_name": payee1_name,
                "sort_code": "40-11-11"
            }
        )
        assert response.status_code == 200
        print(f"✓ Created first transfer to {payee1_name}")
        
        time.sleep(1)  # Ensure different timestamp
        
        payee2_name = f"TEST_Second_{uuid.uuid4().hex[:6]}"
        payee2_account = f"2222222{uuid.uuid4().hex[:3]}"
        
        response = requests.post(
            f"{BASE_URL}/api/transfers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "from_account_id": account_id,
                "to_account_number": payee2_account,
                "amount": 10.00,
                "recipient_name": payee2_name,
                "sort_code": "40-22-22"
            }
        )
        assert response.status_code == 200
        print(f"✓ Created second transfer to {payee2_name}")
        
        time.sleep(0.5)
        
        # Get payees and verify order
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees = response.json()
        
        # Find our test payees
        payee1 = next((p for p in payees if p["name"] == payee1_name), None)
        payee2 = next((p for p in payees if p["name"] == payee2_name), None)
        
        assert payee1 is not None and payee2 is not None
        
        # payee2 should come before payee1 (most recent first)
        payee1_index = payees.index(payee1)
        payee2_index = payees.index(payee2)
        
        assert payee2_index < payee1_index, f"Most recent payee should be first. Got payee2 at {payee2_index}, payee1 at {payee1_index}"
        
        print(f"✓ Payees correctly sorted by last_used descending")
        print(f"  - {payee2_name} (index {payee2_index}) - most recent")
        print(f"  - {payee1_name} (index {payee1_index}) - older")
        
        # Store IDs for cleanup
        payee_ids.extend([payee1["id"], payee2["id"]])
    
    def test_07_delete_payee(self):
        """Test DELETE /api/payees/{id}"""
        # Get current payees
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees_before = response.json()
        count_before = len(payees_before)
        
        # Find a TEST_ payee to delete
        test_payee = next((p for p in payees_before if p["name"].startswith("TEST_")), None)
        
        if test_payee is None:
            pytest.skip("No TEST_ payee found to delete")
        
        payee_id_to_delete = test_payee["id"]
        payee_name = test_payee["name"]
        
        # Delete the payee
        response = requests.delete(
            f"{BASE_URL}/api/payees/{payee_id_to_delete}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Delete payee failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        
        print(f"✓ Payee deleted: {payee_name}")
        
        # Verify payee was deleted
        response = requests.get(
            f"{BASE_URL}/api/payees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        payees_after = response.json()
        count_after = len(payees_after)
        
        assert count_after == count_before - 1, f"Payee count should decrease by 1"
        
        # Verify the specific payee is gone
        deleted_payee = next((p for p in payees_after if p["id"] == payee_id_to_delete), None)
        assert deleted_payee is None, "Deleted payee should not be in list"
        
        print(f"✓ Payee successfully removed from list")
    
    def test_08_delete_nonexistent_payee(self):
        """Test DELETE /api/payees/{id} with non-existent ID returns 404"""
        fake_payee_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/payees/{fake_payee_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 404, "Should return 404 for non-existent payee"
        assert "not found" in response.json()["detail"].lower()
        
        print("✓ Non-existent payee deletion correctly returns 404")
    
    def test_09_get_payees_unauthorized(self):
        """Test GET /api/payees without auth token fails"""
        response = requests.get(f"{BASE_URL}/api/payees")
        
        assert response.status_code == 403, "Should fail without auth token"
        print("✓ Unauthorized payees access correctly rejected")
    
    def test_10_delete_payee_unauthorized(self):
        """Test DELETE /api/payees/{id} without auth token fails"""
        response = requests.delete(f"{BASE_URL}/api/payees/some-id")
        
        assert response.status_code == 403, "Should fail without auth token"
        print("✓ Unauthorized payee deletion correctly rejected")


# Pytest configuration
@pytest.fixture(scope="session", autouse=True)
def setup_test_session():
    """Setup before all tests"""
    print("\n" + "="*60)
    print("Recent Payees Feature - Backend API Tests")
    print("="*60)
    yield
    print("\n" + "="*60)
    print("Recent Payees Backend Tests Complete")
    print("="*60)
