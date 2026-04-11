from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import random
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserInDB(User):
    password_hash: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    account_number: str
    account_type: str  # checking, savings
    balance: float = 0.0
    currency: str = "USD"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    from_account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    amount: float
    transaction_type: str  # transfer, payment, deposit, withdrawal
    description: str
    recipient_name: Optional[str] = None
    status: str = "completed"  # pending, completed, failed
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TransferRequest(BaseModel):
    from_account_id: str
    to_account_number: str
    amount: float
    description: str = ""
    recipient_name: str = ""

class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_number: str  # masked
    card_type: str  # debit, credit
    card_name: str
    expiry_date: str
    cvv: str  # masked
    is_frozen: bool = False
    credit_limit: Optional[float] = None
    available_credit: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Biller(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str  # utilities, internet, phone, insurance, etc.
    account_number: str
    icon: str = "receipt"

class BillPaymentRequest(BaseModel):
    from_account_id: str
    biller_id: str
    amount: float
    reference: str = ""

# ==================== HELPER FUNCTIONS ====================

def generate_account_number():
    return ''.join(random.choices(string.digits, k=10))

def generate_card_number():
    return ''.join(random.choices(string.digits, k=16))

def mask_card_number(card_number: str) -> str:
    return f"****{card_number[-4:]}"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = await db.users.find_one({"id": user_id})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user_data)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user_dict)
    
    # Create default accounts
    checking_account = Account(
        user_id=user_id,
        account_number=generate_account_number(),
        account_type="checking",
        balance=5000.00  # Demo starting balance
    )
    savings_account = Account(
        user_id=user_id,
        account_number=generate_account_number(),
        account_type="savings",
        balance=10000.00  # Demo starting balance
    )
    await db.accounts.insert_one(checking_account.dict())
    await db.accounts.insert_one(savings_account.dict())
    
    # Create default cards
    debit_card = Card(
        user_id=user_id,
        card_number=generate_card_number(),
        card_type="debit",
        card_name="Visa Debit",
        expiry_date="12/28",
        cvv="***"
    )
    credit_card = Card(
        user_id=user_id,
        card_number=generate_card_number(),
        card_type="credit",
        card_name="Mastercard Platinum",
        expiry_date="06/29",
        cvv="***",
        credit_limit=15000.00,
        available_credit=12500.00
    )
    await db.cards.insert_one(debit_card.dict())
    await db.cards.insert_one(credit_card.dict())
    
    # Create initial transaction (deposit)
    initial_transaction = Transaction(
        user_id=user_id,
        to_account_id=checking_account.id,
        amount=5000.00,
        transaction_type="deposit",
        description="Welcome bonus deposit",
        recipient_name="VaultBank"
    )
    await db.transactions.insert_one(initial_transaction.dict())
    
    # Generate token
    access_token = create_access_token(data={"sub": user_id})
    user = User(id=user_id, email=user_data.email, name=user_data.name)
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    user_obj = User(id=user["id"], email=user["email"], name=user["name"])
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== ACCOUNT ENDPOINTS ====================

@api_router.get("/accounts", response_model=List[Account])
async def get_accounts(current_user: User = Depends(get_current_user)):
    accounts = await db.accounts.find({"user_id": current_user.id}).to_list(100)
    return [Account(**acc) for acc in accounts]

@api_router.get("/accounts/{account_id}", response_model=Account)
async def get_account(account_id: str, current_user: User = Depends(get_current_user)):
    account = await db.accounts.find_one({"id": account_id, "user_id": current_user.id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return Account(**account)

# ==================== TRANSACTION ENDPOINTS ====================

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(current_user: User = Depends(get_current_user), limit: int = 50):
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("timestamp", -1).to_list(limit)
    return [Transaction(**txn) for txn in transactions]

@api_router.post("/transfers", response_model=Transaction)
async def create_transfer(transfer: TransferRequest, current_user: User = Depends(get_current_user)):
    # Get source account
    from_account = await db.accounts.find_one({"id": transfer.from_account_id, "user_id": current_user.id})
    if not from_account:
        raise HTTPException(status_code=404, detail="Source account not found")
    
    if from_account["balance"] < transfer.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    # Check if transfer is to own account or external
    to_account = await db.accounts.find_one({"account_number": transfer.to_account_number})
    
    # Update source account balance
    await db.accounts.update_one(
        {"id": transfer.from_account_id},
        {"$inc": {"balance": -transfer.amount}}
    )
    
    # If internal transfer, update destination account
    if to_account:
        await db.accounts.update_one(
            {"id": to_account["id"]},
            {"$inc": {"balance": transfer.amount}}
        )
    
    # Create transaction record
    transaction = Transaction(
        user_id=current_user.id,
        from_account_id=transfer.from_account_id,
        to_account_id=to_account["id"] if to_account else None,
        amount=transfer.amount,
        transaction_type="transfer",
        description=transfer.description or f"Transfer to {transfer.to_account_number}",
        recipient_name=transfer.recipient_name or "External Account"
    )
    await db.transactions.insert_one(transaction.dict())
    
    return transaction

# ==================== BILL PAYMENT ENDPOINTS ====================

@api_router.get("/billers", response_model=List[Biller])
async def get_billers():
    # Return predefined billers
    billers = [
        Biller(id="1", name="Electric Company", category="utilities", account_number="EC123456", icon="flash"),
        Biller(id="2", name="Water Services", category="utilities", account_number="WS789012", icon="water"),
        Biller(id="3", name="Internet Provider", category="internet", account_number="IP345678", icon="wifi"),
        Biller(id="4", name="Mobile Carrier", category="phone", account_number="MC901234", icon="phone-portrait"),
        Biller(id="5", name="Insurance Co.", category="insurance", account_number="IC567890", icon="shield-checkmark"),
        Biller(id="6", name="Gas Company", category="utilities", account_number="GC123789", icon="flame"),
        Biller(id="7", name="Cable TV", category="entertainment", account_number="CT456123", icon="tv"),
        Biller(id="8", name="Credit Card", category="finance", account_number="CC789456", icon="card"),
    ]
    return billers

@api_router.post("/bills/pay", response_model=Transaction)
async def pay_bill(payment: BillPaymentRequest, current_user: User = Depends(get_current_user)):
    # Get source account
    from_account = await db.accounts.find_one({"id": payment.from_account_id, "user_id": current_user.id})
    if not from_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if from_account["balance"] < payment.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    # Get biller info
    billers = await get_billers()
    biller = next((b for b in billers if b.id == payment.biller_id), None)
    if not biller:
        raise HTTPException(status_code=404, detail="Biller not found")
    
    # Update account balance
    await db.accounts.update_one(
        {"id": payment.from_account_id},
        {"$inc": {"balance": -payment.amount}}
    )
    
    # Create transaction
    transaction = Transaction(
        user_id=current_user.id,
        from_account_id=payment.from_account_id,
        amount=payment.amount,
        transaction_type="payment",
        description=f"Bill payment - {biller.name}",
        recipient_name=biller.name
    )
    await db.transactions.insert_one(transaction.dict())
    
    return transaction

# ==================== CARD ENDPOINTS ====================

@api_router.get("/cards", response_model=List[dict])
async def get_cards(current_user: User = Depends(get_current_user)):
    cards = await db.cards.find({"user_id": current_user.id}).to_list(100)
    # Mask card numbers for response
    result = []
    for card in cards:
        card_dict = dict(card)
        card_dict["card_number_masked"] = mask_card_number(card["card_number"])
        del card_dict["_id"]
        result.append(card_dict)
    return result

@api_router.post("/cards/{card_id}/freeze")
async def freeze_card(card_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cards.update_one(
        {"id": card_id, "user_id": current_user.id},
        {"$set": {"is_frozen": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"message": "Card frozen successfully"}

@api_router.post("/cards/{card_id}/unfreeze")
async def unfreeze_card(card_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cards.update_one(
        {"id": card_id, "user_id": current_user.id},
        {"$set": {"is_frozen": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"message": "Card unfrozen successfully"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    # Get all accounts
    accounts = await db.accounts.find({"user_id": current_user.id}).to_list(100)
    total_balance = sum(acc["balance"] for acc in accounts)
    
    # Get recent transactions
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("timestamp", -1).to_list(5)
    
    # Calculate monthly spending
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_transactions = await db.transactions.find({
        "user_id": current_user.id,
        "transaction_type": {"$in": ["transfer", "payment"]},
        "timestamp": {"$gte": start_of_month}
    }).to_list(1000)
    monthly_spending = sum(txn["amount"] for txn in monthly_transactions)
    
    return {
        "total_balance": total_balance,
        "monthly_spending": monthly_spending,
        "accounts_count": len(accounts),
        "recent_transactions": [Transaction(**txn).dict() for txn in transactions]
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
