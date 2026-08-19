from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
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
import io
import csv
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings — the app is 100% offline for banking flows, but the auth
# router is still exposed to guard the (unused-in-prod) FastAPI routes.
# Fail fast if JWT_SECRET is missing so we never ship the placeholder value.
SECRET_KEY = os.environ.get('JWT_SECRET')
if not SECRET_KEY:
    raise RuntimeError(
        'JWT_SECRET environment variable is required. '
        'Set it in backend/.env before starting the server.'
    )
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

class PasscodeLogin(BaseModel):
    passcode: str

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
    sort_code: str = ""
    account_type: str  # checking, savings
    balance: float = 0.0
    currency: str = "GBP"
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
    recipient_sort_code: Optional[str] = None
    recipient_account_number: Optional[str] = None
    recipient_bank_name: Optional[str] = None
    reference: Optional[str] = None
    trn: Optional[str] = None  # Transaction Reference Number (sender-assigned)
    fpid: Optional[str] = None  # Faster Payment ID
    status: str = "completed"  # pending, completed, failed
    timestamp: datetime = Field(default_factory=datetime.utcnow)


def generate_trn(seed: str) -> str:
    """Generate a 16-char alphanumeric Transaction Reference Number (uppercase)."""
    import hashlib
    h = hashlib.sha256(seed.encode()).hexdigest().upper()
    # Convert hex to alphanumeric-ish, take 16 chars
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    out = []
    for i in range(0, 32, 2):
        n = int(h[i:i+2], 16)
        out.append(alphabet[n % len(alphabet)])
    return "TRN" + "".join(out[:13])  # e.g. TRN + 13 chars = 16 total


def generate_fpid(seed: str) -> str:
    """Generate an 18-digit Faster Payment ID prefixed with FP (e.g. FP180527420019823017)."""
    import hashlib
    h = hashlib.sha256(("fpid:" + seed).encode()).hexdigest()
    # Take first 18 hex chars, convert to int, mod to fit 18 digits
    n = int(h[:16], 16) % (10 ** 18)
    return f"FP{n:018d}"

class TransferRequest(BaseModel):
    from_account_id: str
    to_account_number: str
    amount: float
    description: str = ""
    recipient_name: str = ""
    sort_code: str = ""

class Payee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    sort_code: str
    account_number: str
    last_used: datetime = Field(default_factory=datetime.utcnow)

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

VALID_PASSCODE = "0503"
DEFAULT_USER_NAME = "Oliver"
DEFAULT_USER_EMAIL = "customer@hsbc.co.uk"

@api_router.post("/auth/passcode")
async def passcode_login(data: PasscodeLogin):
    # Accept ANY 4-digit numeric passcode (any 4 digits will log you in)
    if not data.passcode or len(data.passcode) != 4 or not data.passcode.isdigit():
        raise HTTPException(status_code=401, detail="Passcode must be 4 digits")
    
    # Find or create the default user
    user_data = await db.users.find_one({"email": DEFAULT_USER_EMAIL})
    
    if not user_data:
        # Create user on first passcode login
        user_id = str(uuid.uuid4())
        user_dict = {
            "id": user_id,
            "email": DEFAULT_USER_EMAIL,
            "name": DEFAULT_USER_NAME,
            "password_hash": hash_password(VALID_PASSCODE),
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_dict)
        
        # Create GBP accounts
        checking_account = Account(
            user_id=user_id,
            account_number="92647194",
            sort_code="44-91-51",
            account_type="checking",
            balance=5000.00,
            currency="GBP"
        )
        savings_account = Account(
            user_id=user_id,
            account_number=generate_account_number(),
            sort_code="44-91-51",
            account_type="savings",
            balance=10000.00,
            currency="GBP"
        )
        await db.accounts.insert_one(checking_account.dict())
        await db.accounts.insert_one(savings_account.dict())
        
        # Create cards with specific card number
        debit_card = Card(
            user_id=user_id,
            card_number="5273400012345678",
            card_type="debit",
            card_name="HSBC Visa Debit",
            expiry_date="12/28",
            cvv="***"
        )
        credit_card = Card(
            user_id=user_id,
            card_number="5273400098765432",
            card_type="credit",
            card_name="HSBC Mastercard Platinum",
            expiry_date="06/29",
            cvv="***",
            credit_limit=15000.00,
            available_credit=12500.00
        )
        await db.cards.insert_one(debit_card.dict())
        await db.cards.insert_one(credit_card.dict())
        
        # Generate random transactions (£10-£140) with varied dates
        transaction_templates = [
            ("transfer", "Rent Payment", "Landlord Properties"),
            ("transfer", "Salary Transfer", "ABC Company Ltd"),
            ("payment", "Bill payment - Electric Company", "British Gas"),
            ("payment", "Bill payment - Internet Provider", "BT Broadband"),
            ("payment", "Bill payment - Mobile Carrier", "Vodafone UK"),
            ("transfer", "Grocery Shopping", "Tesco Superstore"),
            ("transfer", "Online Purchase", "Amazon UK"),
            ("payment", "Bill payment - Water Services", "Thames Water"),
            ("deposit", "Monthly Salary", "ABC Company Ltd"),
            ("deposit", "Refund", "ASOS Returns"),
            ("transfer", "Coffee Shop", "Costa Coffee"),
            ("transfer", "Transport", "TfL Oyster"),
            ("payment", "Bill payment - Insurance Co.", "Aviva Insurance"),
            ("transfer", "Restaurant", "Pizza Express"),
            ("deposit", "Birthday Gift", "Jane Smith"),
            ("transfer", "Gym Membership", "PureGym"),
            ("payment", "Bill payment - Gas Company", "British Gas"),
            ("transfer", "Cinema Tickets", "Odeon Cinemas"),
            ("deposit", "Freelance Work", "Design Co Ltd"),
            ("transfer", "Subscription", "Netflix UK"),
        ]
        
        for i, (txn_type, desc, recipient) in enumerate(transaction_templates):
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            mins_ago = random.randint(0, 59)
            txn_time = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago, minutes=mins_ago)
            amount = round(random.uniform(10, 140), 2)
            
            txn = Transaction(
                user_id=user_id,
                from_account_id=checking_account.id if txn_type != "deposit" else None,
                to_account_id=checking_account.id if txn_type == "deposit" else None,
                amount=amount,
                transaction_type=txn_type,
                description=desc,
                recipient_name=recipient,
                timestamp=txn_time,
            )
            await db.transactions.insert_one(txn.dict())
        
        # Welcome notification
        await create_notification(user_id, "Welcome to HSBC!", f"Hello, your accounts are ready with £5,000 in Current and £10,000 in Savings.", "welcome")
        
        access_token = create_access_token(data={"sub": user_id})
        user = User(id=user_id, email=DEFAULT_USER_EMAIL, name=DEFAULT_USER_NAME)
        return {"access_token": access_token, "token_type": "bearer", "user": user.dict()}
    else:
        user_id = user_data["id"]
        # Ensure existing accounts have correct sort code and current account number
        await db.accounts.update_many(
            {"user_id": user_id, "$or": [{"sort_code": {"$exists": False}}, {"sort_code": ""}, {"sort_code": "40-47-84"}]},
            {"$set": {"sort_code": "44-91-51"}}
        )
        await db.accounts.update_one(
            {"user_id": user_id, "account_type": "checking"},
            {"$set": {"account_number": "92647194", "sort_code": "44-91-51"}}
        )
        access_token = create_access_token(data={"sub": user_id})
        user = User(**user_data)
        return {"access_token": access_token, "token_type": "bearer", "user": user.dict()}

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
    
    # Welcome notification
    await create_notification(user_id, "Welcome to HSBC!", f"Hello {user_data.name}, your accounts are ready. You have £5,000 in Checking and £10,000 in Savings.", "welcome")
    
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

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class AccountDetailsUpdate(BaseModel):
    account_id: str
    sort_code: Optional[str] = None
    account_number: Optional[str] = None

@api_router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    return user_data

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user)):
    update_fields = {k: v for k, v in data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"id": current_user.id}, {"$set": update_fields})
    updated = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    return updated

@api_router.put("/accounts/details")
async def update_account_details(data: AccountDetailsUpdate, current_user: User = Depends(get_current_user)):
    account = await db.accounts.find_one({"id": data.account_id, "user_id": current_user.id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    update_fields = {}
    if data.sort_code:
        update_fields["sort_code"] = data.sort_code
    if data.account_number:
        update_fields["account_number"] = data.account_number
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.accounts.update_one({"id": data.account_id}, {"$set": update_fields})
    updated = await db.accounts.find_one({"id": data.account_id}, {"_id": 0})
    return updated

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
async def get_transactions(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    filter_type: Optional[str] = None,  # all, sent, received
):
    query = {"user_id": current_user.id}
    
    if filter_type == "sent":
        query["transaction_type"] = {"$in": ["transfer", "payment"]}
    elif filter_type == "received":
        query["transaction_type"] = "deposit"
    
    transactions = await db.transactions.find(query).sort("timestamp", -1).to_list(limit)
    result = []
    for txn in transactions:
        if not txn.get("trn"):
            txn["trn"] = generate_trn(txn.get("id", ""))
        if not txn.get("fpid"):
            txn["fpid"] = generate_fpid(txn.get("id", ""))
        result.append(Transaction(**txn))
    return result

@api_router.get("/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str, current_user: User = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": transaction_id, "user_id": current_user.id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not txn.get("trn"):
        txn["trn"] = generate_trn(transaction_id)
    if not txn.get("fpid"):
        txn["fpid"] = generate_fpid(transaction_id)
    return Transaction(**txn)

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: User = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": transaction_id, "user_id": current_user.id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.transactions.delete_one({"id": transaction_id, "user_id": current_user.id})
    return {"message": "Transaction deleted", "id": transaction_id}


# ==================== INTERNATIONAL TRANSFER (SWIFT/IBAN) ====================
class InternationalTransferRequest(BaseModel):
    from_account_id: str
    amount: float
    source_currency: str = "GBP"
    target_currency: str = "EUR"
    recipient_name: str
    iban: str
    swift_bic: str
    recipient_country: str = ""
    recipient_address: str = ""
    purpose: str = ""
    charges_option: str = "SHA"  # OUR / BEN / SHA
    is_business: bool = False
    invoice_number: Optional[str] = None

@api_router.post("/transfers/international")
async def create_international_transfer(data: InternationalTransferRequest, current_user: User = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    from_account = await db.accounts.find_one({"id": data.from_account_id, "user_id": current_user.id})
    if not from_account:
        raise HTTPException(status_code=404, detail="From account not found")
    if from_account.get("balance", 0) < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    # Fetch live FX rate (server-side proxy) for amount in target currency
    rate = await _fetch_fx_rate(data.source_currency, data.target_currency)
    target_amount = round(data.amount * rate, 2)

    # Deduct from source account
    await db.accounts.update_one({"id": data.from_account_id}, {"$inc": {"balance": -data.amount}})

    txn = Transaction(
        user_id=current_user.id,
        from_account_id=data.from_account_id,
        amount=data.amount,
        transaction_type="international",
        description=data.purpose or f"International transfer to {data.recipient_name}",
        recipient_name=data.recipient_name,
        recipient_account_number=data.iban,
        recipient_sort_code=data.swift_bic,
        recipient_bank_name=f"SWIFT/{data.swift_bic[:8]}",
        reference=data.invoice_number or data.purpose,
    )
    txn.trn = generate_trn(txn.id)
    txn.fpid = generate_fpid(txn.id)
    # Store extra fields
    txn_dict = txn.dict()
    txn_dict.update({
        "is_international": True,
        "source_currency": data.source_currency,
        "target_currency": data.target_currency,
        "fx_rate": rate,
        "target_amount": target_amount,
        "swift_bic": data.swift_bic,
        "iban": data.iban,
        "country": data.recipient_country,
        "charges_option": data.charges_option,
        "is_business": data.is_business,
        "invoice_number": data.invoice_number,
    })
    await db.transactions.insert_one(txn_dict)
    await create_notification(current_user.id, "International Transfer Sent", f"£{data.amount:.2f} sent ({data.target_currency} {target_amount:.2f}) to {data.recipient_name}", "transfer", {"transaction_id": txn.id})
    return {
        "transaction_id": txn.id,
        "amount_sent": data.amount,
        "source_currency": data.source_currency,
        "amount_received": target_amount,
        "target_currency": data.target_currency,
        "fx_rate": rate,
        "trn": txn.trn,
        "fpid": txn.fpid,
        "status": "completed",
        "estimated_arrival": "1-3 business days",
    }


# ==================== FX RATES ====================
import httpx as _httpx
from typing import Any as _Any
_FX_CACHE: dict = {"ts": 0, "data": None}

# Fallback static rates (used if external API fails)
_FX_FALLBACK = {
    "USD": 1.0, "GBP": 0.79, "EUR": 0.92, "JPY": 151.5, "AUD": 1.51, "CAD": 1.36,
    "CHF": 0.91, "CNY": 7.23, "INR": 83.5, "AED": 3.67, "SGD": 1.34, "HKD": 7.82,
    "ZAR": 18.7, "BRL": 5.05, "MXN": 17.0, "NZD": 1.65, "TRY": 32.5, "SEK": 10.7,
    "NOK": 10.8, "DKK": 6.9, "PLN": 4.0, "THB": 36.0,
}

async def _fetch_fx_rate(from_ccy: str, to_ccy: str) -> float:
    """Return the multiplier so that amount_in_from * rate = amount_in_to."""
    if from_ccy == to_ccy:
        return 1.0
    import time
    now = time.time()
    # Cache full rate table for 15 minutes
    if _FX_CACHE["data"] and now - _FX_CACHE["ts"] < 900:
        rates = _FX_CACHE["data"]
    else:
        rates = None
        try:
            async with _httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get("https://open.er-api.com/v6/latest/USD")
                if r.status_code == 200:
                    j = r.json()
                    if j.get("result") == "success" and j.get("rates"):
                        rates = j["rates"]
                        _FX_CACHE["data"] = rates
                        _FX_CACHE["ts"] = now
        except Exception:
            pass
        if not rates:
            rates = _FX_FALLBACK
    # USD-based rates: convert source→USD→target
    src = rates.get(from_ccy.upper())
    dst = rates.get(to_ccy.upper())
    if not src or not dst:
        return 1.0
    return round(dst / src, 6)

@api_router.get("/fx/rate")
async def fx_rate(from_ccy: str = "GBP", to_ccy: str = "EUR", amount: float = 1.0, current_user: User = Depends(get_current_user)):
    rate = await _fetch_fx_rate(from_ccy, to_ccy)
    return {
        "from": from_ccy.upper(),
        "to": to_ccy.upper(),
        "rate": rate,
        "amount": amount,
        "converted": round(amount * rate, 2),
        "source": "open.er-api.com" if _FX_CACHE["data"] else "fallback",
    }

@api_router.get("/fx/currencies")
async def fx_currencies(current_user: User = Depends(get_current_user)):
    """Return a list of supported currencies for the dropdown."""
    currencies = [
        {"code": "GBP", "name": "British Pound", "symbol": "£", "flag": "🇬🇧"},
        {"code": "USD", "name": "US Dollar", "symbol": "$", "flag": "🇺🇸"},
        {"code": "EUR", "name": "Euro", "symbol": "€", "flag": "🇪🇺"},
        {"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "flag": "🇯🇵"},
        {"code": "AUD", "name": "Australian Dollar", "symbol": "A$", "flag": "🇦🇺"},
        {"code": "CAD", "name": "Canadian Dollar", "symbol": "C$", "flag": "🇨🇦"},
        {"code": "CHF", "name": "Swiss Franc", "symbol": "CHF", "flag": "🇨🇭"},
        {"code": "CNY", "name": "Chinese Yuan", "symbol": "¥", "flag": "🇨🇳"},
        {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "flag": "🇮🇳"},
        {"code": "AED", "name": "UAE Dirham", "symbol": "د.إ", "flag": "🇦🇪"},
        {"code": "SGD", "name": "Singapore Dollar", "symbol": "S$", "flag": "🇸🇬"},
        {"code": "HKD", "name": "Hong Kong Dollar", "symbol": "HK$", "flag": "🇭🇰"},
        {"code": "ZAR", "name": "South African Rand", "symbol": "R", "flag": "🇿🇦"},
        {"code": "NZD", "name": "New Zealand Dollar", "symbol": "NZ$", "flag": "🇳🇿"},
        {"code": "NOK", "name": "Norwegian Krone", "symbol": "kr", "flag": "🇳🇴"},
        {"code": "SEK", "name": "Swedish Krona", "symbol": "kr", "flag": "🇸🇪"},
        {"code": "DKK", "name": "Danish Krone", "symbol": "kr", "flag": "🇩🇰"},
        {"code": "PLN", "name": "Polish Zloty", "symbol": "zł", "flag": "🇵🇱"},
    ]
    return currencies


# ==================== MONTHLY STATEMENT PDF ====================
@api_router.get("/statements/monthly")
async def download_monthly_statement(year: int, month: int, current_user: User = Depends(get_current_user)):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    from fastapi.responses import Response
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from calendar import monthrange
    start = datetime(year, month, 1)
    last_day = monthrange(year, month)[1]
    end = datetime(year, month, last_day, 23, 59, 59)
    transactions = await db.transactions.find({
        "user_id": current_user.id,
        "timestamp": {"$gte": start, "$lte": end},
    }).sort("timestamp", 1).to_list(1000)

    # Pull user profile + accounts for the real statement header
    profile = await db.users.find_one({"id": current_user.id}) or {}
    accounts = await db.accounts.find({"user_id": current_user.id}).to_list(50)
    total_balance = sum(a.get("balance", 0) for a in accounts)

    # Choose the primary (checking) account for the statement header detail
    primary = next((a for a in accounts if a.get("account_type") == "checking"), accounts[0] if accounts else {})
    full_name = profile.get("name") or current_user.name
    address = profile.get("address") or "8 Canada Square, London E14 5HQ, United Kingdom"
    email = profile.get("email") or ""
    phone = profile.get("phone") or ""
    sort_code = primary.get("sort_code", "44-91-51")
    acct_num = primary.get("account_number", "92647194")
    # Derive IBAN/BIC from sort code + acct number
    raw_acc = (acct_num or "").replace(" ", "").zfill(8)[-8:]
    raw_sort = (sort_code or "").replace("-", "").replace(" ", "").zfill(6)[-6:]
    iban = f"GB29 HBUK {raw_sort[0:2]}{raw_sort[2:4]} {raw_sort[4:6]}{raw_acc[0:2]} {raw_acc[2:6]} {raw_acc[6:8]}".strip()
    bic = "HBUKGB4B"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=36, bottomMargin=36, leftMargin=40, rightMargin=40,
        title=f"HSBC UK Statement {start.strftime('%B %Y')}",
        author="HSBC UK Mobile Banking",
    )
    styles = getSampleStyleSheet()
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_LEFT
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors as rcolors
    HSBC_RED = rcolors.HexColor("#DB0011")
    DARK = rcolors.HexColor("#0B1424")
    MID = rcolors.HexColor("#5E6A7A")
    LIGHT = rcolors.HexColor("#F1F3F6")

    title_style = ParagraphStyle("t", parent=styles["Title"], textColor=HSBC_RED, fontSize=20, leading=22, alignment=TA_LEFT, spaceAfter=0)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontSize=10, textColor=MID, alignment=TA_LEFT)
    small = ParagraphStyle("sm", parent=styles["Normal"], fontSize=9, textColor=MID, alignment=TA_LEFT)
    label = ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, textColor=MID, alignment=TA_LEFT, leading=10)
    value = ParagraphStyle("v", parent=styles["Normal"], fontSize=10, textColor=DARK, alignment=TA_LEFT, leading=12)
    bold_value = ParagraphStyle("bv", parent=styles["Normal"], fontSize=11, textColor=DARK, alignment=TA_LEFT, leading=13, fontName="Helvetica-Bold")
    right = ParagraphStyle("rt", parent=styles["Normal"], fontSize=9, textColor=DARK, alignment=TA_RIGHT)
    section_header = ParagraphStyle("sh", parent=styles["Normal"], fontSize=11, textColor=HSBC_RED, fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4)

    elements = []

    # ============ HEADER ============
    header_data = [[
        Paragraph("<b>HSBC UK</b>", title_style),
        Paragraph(
            f"<b>HSBC UK Bank plc</b><br/>"
            f"1 Centenary Square<br/>"
            f"Birmingham, B1 1HQ<br/>"
            f"www.hsbc.co.uk &nbsp; · &nbsp; 03457 404 404",
            small,
        ),
    ]]
    header_tbl = Table(header_data, colWidths=[200, 320])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    elements.append(header_tbl)
    elements.append(Spacer(1, 6))
    # Divider
    div = Table([[""]], colWidths=[520], rowHeights=[2])
    div.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), HSBC_RED)]))
    elements.append(div)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Monthly Bank Statement", ParagraphStyle("h", parent=styles["Heading1"], textColor=DARK, fontSize=18, spaceAfter=2)))
    elements.append(Paragraph(f"Statement period: <b>{start.strftime('%d %b %Y')} – {end.strftime('%d %b %Y')}</b>", sub_style))
    elements.append(Spacer(1, 12))

    # ============ ACCOUNT HOLDER + ACCOUNT BOX ============
    holder_block = [
        [Paragraph("<b>Account Holder</b>", label)],
        [Paragraph(full_name.upper(), bold_value)],
        [Paragraph(address.replace(", ", "<br/>") , value)],
        [Paragraph(f"{email}", small)] if email else [],
        [Paragraph(f"{phone}", small)] if phone else [],
    ]
    holder_block = [r for r in holder_block if r]

    detail_block = [
        [Paragraph("<b>Account Details</b>", label)],
        [Paragraph("Account Type", label), Paragraph("Current Account", value)],
        [Paragraph("Sort Code", label), Paragraph(sort_code, value)],
        [Paragraph("Account Number", label), Paragraph(acct_num, value)],
        [Paragraph("IBAN", label), Paragraph(iban, value)],
        [Paragraph("BIC / SWIFT", label), Paragraph(bic, value)],
        [Paragraph("Currency", label), Paragraph("GBP £", value)],
    ]

    holder_tbl = Table(holder_block, colWidths=[260])
    holder_tbl.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BACKGROUND", (0, 0), (-1, -1), LIGHT)]))

    detail_tbl = Table(detail_block[1:], colWidths=[85, 175])
    detail_tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    detail_wrapper = Table([[detail_block[0][0]], [detail_tbl]], colWidths=[260])
    detail_wrapper.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 12), ("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("TOPPADDING", (0, 0), (-1, -1), 4)]))

    info_tbl = Table([[holder_tbl, detail_wrapper]], colWidths=[260, 260])
    info_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(info_tbl)
    elements.append(Spacer(1, 14))

    # ============ BALANCE SUMMARY ============
    money_in = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "deposit")
    money_out = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") != "deposit")
    closing = total_balance
    opening = round(closing - (money_in - money_out), 2)

    summary_data = [
        ["Opening balance", "Money in", "Money out", "Closing balance"],
        [f"£{opening:,.2f}", f"+£{money_in:,.2f}", f"-£{money_out:,.2f}", f"£{closing:,.2f}"],
    ]
    summary_tbl = Table(summary_data, colWidths=[130, 130, 130, 130])
    summary_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HSBC_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), rcolors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (0, 1), DARK),
        ("TEXTCOLOR", (1, 1), (1, 1), rcolors.HexColor("#00847F")),
        ("TEXTCOLOR", (2, 1), (2, 1), HSBC_RED),
        ("TEXTCOLOR", (3, 1), (3, 1), DARK),
    ]))
    elements.append(summary_tbl)
    elements.append(Spacer(1, 18))

    # ============ TRANSACTIONS TABLE ============
    elements.append(Paragraph("Transaction Details", section_header))
    if not transactions:
        empty_tbl = Table([[Paragraph("No transactions in this period.", value)]], colWidths=[520])
        empty_tbl.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("TOPPADDING", (0, 0), (-1, -1), 20), ("BOTTOMPADDING", (0, 0), (-1, -1), 20), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
        elements.append(empty_tbl)
    else:
        data = [["Date", "Description", "Reference / TRN", "Money In", "Money Out", "Balance"]]
        running = opening
        for txn in transactions:
            ts = txn.get("timestamp", datetime.utcnow())
            date_str = ts.strftime("%d %b") if isinstance(ts, datetime) else str(ts)
            txn_type = txn.get("transaction_type", "")
            recipient = txn.get("recipient_name") or txn.get("description", "")
            desc_lines = recipient[:30]
            if txn.get("recipient_bank_name"):
                desc_lines += f"\n{txn['recipient_bank_name']}"
            ref = txn.get("trn") or txn.get("id", "")[:12].upper()
            amount = txn.get("amount", 0)
            if txn_type == "deposit":
                running += amount
                in_col = f"£{amount:,.2f}"
                out_col = ""
            else:
                running -= amount
                in_col = ""
                out_col = f"£{amount:,.2f}"
            data.append([date_str, desc_lines, ref, in_col, out_col, f"£{running:,.2f}"])
        txn_tbl = Table(data, colWidths=[55, 160, 110, 70, 70, 75])
        txn_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), rcolors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (3, 0), (5, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rcolors.white, LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.3, rcolors.HexColor("#CCCCCC")),
            ("TEXTCOLOR", (3, 1), (3, -1), rcolors.HexColor("#00847F")),
            ("TEXTCOLOR", (4, 1), (4, -1), HSBC_RED),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(txn_tbl)

    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Important information", section_header))
    elements.append(Paragraph(
        "Please check this statement carefully and tell us about any items that you think are wrong or you do not recognise within 30 days. "
        "This statement was generated electronically by HSBC UK Mobile Banking and does not require a signature. "
        "HSBC UK Bank plc is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority and the Prudential Regulation Authority. Registered in England and Wales (Company No. 09928412).",
        ParagraphStyle("imp", parent=styles["Normal"], fontSize=8, textColor=MID, leading=11, alignment=TA_LEFT),
    ))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"Statement generated on {datetime.utcnow().strftime('%d %b %Y at %H:%M')} UTC · Page 1 of 1", small))

    doc.build(elements)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="HSBC_Statement_{year}_{month:02d}.pdf"'}
    )


@api_router.get("/statements/csv")
async def download_csv_statement(current_user: User = Depends(get_current_user), limit: int = 100):
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("timestamp", -1).to_list(limit)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Description", "Recipient", "Amount (USD)", "Status"])
    
    for txn in transactions:
        ts = txn.get("timestamp", datetime.utcnow())
        if isinstance(ts, datetime):
            date_str = ts.strftime("%Y-%m-%d %H:%M")
        else:
            date_str = str(ts)
        
        txn_type = txn.get("transaction_type", "").title()
        desc = txn.get("description", "")
        recipient = txn.get("recipient_name", "")
        amount = txn.get("amount", 0)
        status = txn.get("status", "completed").title()
        
        prefix = "+" if txn.get("transaction_type") == "deposit" else "-"
        writer.writerow([date_str, txn_type, desc, recipient, f"{prefix}£{amount:.2f}", status])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=HSBC_Statement_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/statements/pdf")
async def download_pdf_statement(current_user: User = Depends(get_current_user), limit: int = 100):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("timestamp", -1).to_list(limit)
    accounts = await db.accounts.find({"user_id": current_user.id}).to_list(100)
    total_balance = sum(acc["balance"] for acc in accounts)
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    elements = []
    styles = getSampleStyleSheet()
    
    # Header
    title_style = ParagraphStyle('Title', parent=styles['Title'], textColor=colors.HexColor('#DB0011'), fontSize=24)
    elements.append(Paragraph("HSBC", title_style))
    elements.append(Paragraph(f"Account Statement", styles['Heading2']))
    elements.append(Paragraph(f"Customer: {current_user.name}", styles['Normal']))
    elements.append(Paragraph(f"Email: {current_user.email}", styles['Normal']))
    elements.append(Paragraph(f"Date: {datetime.utcnow().strftime('%B %d, %Y')}", styles['Normal']))
    elements.append(Paragraph(f"Total Balance: £{total_balance:,.2f}", styles['Normal']))
    elements.append(Spacer(1, 10*mm))
    
    # Table
    data = [["Date", "Type", "Description", "Amount", "Status"]]
    for txn in transactions:
        ts = txn.get("timestamp", datetime.utcnow())
        date_str = ts.strftime("%b %d, %Y") if isinstance(ts, datetime) else str(ts)
        txn_type = txn.get("transaction_type", "").title()
        desc = txn.get("description", "")[:30]
        amount = txn.get("amount", 0)
        prefix = "+" if txn.get("transaction_type") == "deposit" else "-"
        status = txn.get("status", "completed").title()
        data.append([date_str, txn_type, desc, f"{prefix}£{amount:.2f}", status])
    
    table = Table(data, colWidths=[80, 60, 180, 80, 60])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DB0011')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
    ]))
    elements.append(table)
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=HSBC_Statement_{datetime.utcnow().strftime('%Y%m%d')}.pdf"}
    )

@api_router.get("/receipts/{transaction_id}")
async def get_receipt(transaction_id: str, current_user: User = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": transaction_id, "user_id": current_user.id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    elements = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Title'], textColor=colors.HexColor('#DB0011'), fontSize=24)
    elements.append(Paragraph("HSBC", title_style))
    elements.append(Paragraph("Transaction Receipt", styles['Heading2']))
    elements.append(Spacer(1, 10*mm))
    
    ts = txn.get("timestamp", datetime.utcnow())
    date_str = ts.strftime("%B %d, %Y at %I:%M %p") if isinstance(ts, datetime) else str(ts)
    prefix = "+" if txn.get("transaction_type") == "deposit" else "-"
    
    data = [
        ["Reference", txn.get("id", "")[:12]],
        ["Date", date_str],
        ["Type", txn.get("transaction_type", "").title()],
        ["Description", txn.get("description", "")],
        ["Recipient", txn.get("recipient_name", "N/A")],
        ["Amount", f"{prefix}£{txn.get('amount', 0):.2f}"],
        ["Status", txn.get("status", "completed").title()],
    ]
    
    table = Table(data, colWidths=[120, 340])
    table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#F5F5F5'), colors.white]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph("Thank you for banking with HSBC", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=HSBC_Receipt_{transaction_id[:8]}.pdf"}
    )

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
    
    # Determine recipient bank name (UK Bank fallback if not recognised)
    recipient_bank_name = None
    if to_account:
        recipient_bank_name = "HSBC UK Bank plc"
    elif transfer.sort_code:
        recipient_bank_name = "UK Bank"

    # Create transaction record
    transaction = Transaction(
        user_id=current_user.id,
        from_account_id=transfer.from_account_id,
        to_account_id=to_account["id"] if to_account else None,
        amount=transfer.amount,
        transaction_type="transfer",
        description=transfer.description or f"Transfer to {transfer.to_account_number}",
        recipient_name=transfer.recipient_name or "External Account",
        recipient_sort_code=transfer.sort_code or None,
        recipient_account_number=transfer.to_account_number,
        recipient_bank_name=recipient_bank_name,
        reference=transfer.description or None,
    )
    # Assign TRN and FPID based on the transaction id (deterministic)
    transaction.trn = generate_trn(transaction.id)
    transaction.fpid = generate_fpid(transaction.id)
    await db.transactions.insert_one(transaction.dict())
    
    # Save/update payee for recent payees feature
    if transfer.recipient_name and transfer.to_account_number:
        existing_payee = await db.payees.find_one({
            "user_id": current_user.id,
            "account_number": transfer.to_account_number,
        })
        if existing_payee:
            await db.payees.update_one(
                {"id": existing_payee["id"]},
                {"$set": {"last_used": datetime.utcnow(), "name": transfer.recipient_name, "sort_code": transfer.sort_code}}
            )
        else:
            payee = Payee(
                user_id=current_user.id,
                name=transfer.recipient_name,
                sort_code=transfer.sort_code,
                account_number=transfer.to_account_number,
            )
            await db.payees.insert_one(payee.dict())
    
    # Transfer notification
    recipient = transfer.recipient_name or "External Account"
    await create_notification(current_user.id, "Transfer Sent", f"£{transfer.amount:.2f} sent to {recipient}", "transfer", {"transaction_id": transaction.id, "amount": transfer.amount})
    
    return transaction

@api_router.get("/payees")
async def get_recent_payees(current_user: User = Depends(get_current_user)):
    payees = await db.payees.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("last_used", -1).to_list(10)
    return payees

@api_router.delete("/payees/{payee_id}")
async def delete_payee(payee_id: str, current_user: User = Depends(get_current_user)):
    result = await db.payees.delete_one({"id": payee_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payee not found")
    return {"message": "Payee deleted"}

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
    
    # Bill payment notification
    await create_notification(current_user.id, "Bill Payment", f"£{payment.amount:.2f} paid to {biller.name}", "payment", {"transaction_id": transaction.id, "biller": biller.name})
    
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
    await create_notification(current_user.id, "Card Frozen", "Your card has been temporarily frozen for security", "card", {"card_id": card_id, "action": "frozen"})
    return {"message": "Card frozen successfully"}

@api_router.post("/cards/{card_id}/unfreeze")
async def unfreeze_card(card_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cards.update_one(
        {"id": card_id, "user_id": current_user.id},
        {"$set": {"is_frozen": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    await create_notification(current_user.id, "Card Activated", "Your card has been unfrozen and is now active", "card", {"card_id": card_id, "action": "unfrozen"})
    return {"message": "Card unfrozen successfully"}

class CardUpdateRequest(BaseModel):
    card_name: Optional[str] = None
    card_number: Optional[str] = None
    expiry_date: Optional[str] = None

@api_router.put("/cards/{card_id}")
async def update_card(card_id: str, data: CardUpdateRequest, current_user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    update_fields = {}
    if data.card_name is not None and data.card_name.strip():
        update_fields["card_name"] = data.card_name.strip()
    if data.card_number is not None and data.card_number.strip():
        # Strip spaces from card number
        clean_number = data.card_number.replace(" ", "").replace("-", "")
        if not clean_number.isdigit() or len(clean_number) < 12:
            raise HTTPException(status_code=400, detail="Invalid card number")
        update_fields["card_number"] = clean_number
    if data.expiry_date is not None and data.expiry_date.strip():
        update_fields["expiry_date"] = data.expiry_date.strip()
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.cards.update_one({"id": card_id}, {"$set": update_fields})
    updated = await db.cards.find_one({"id": card_id})
    updated_dict = dict(updated)
    updated_dict["card_number_masked"] = mask_card_number(updated["card_number"])
    del updated_dict["_id"]
    return updated_dict

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

# ==================== DEPOSIT / ADD MONEY ====================

class DepositRequest(BaseModel):
    account_id: str
    amount: float
    source: str = "bank_transfer"  # bank_transfer, card_deposit, quick_topup
    description: str = ""

@api_router.post("/deposits")
async def add_money(deposit: DepositRequest, current_user: User = Depends(get_current_user)):
    if deposit.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    account = await db.accounts.find_one({"id": deposit.account_id, "user_id": current_user.id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Credit the account
    await db.accounts.update_one(
        {"id": deposit.account_id},
        {"$inc": {"balance": deposit.amount}}
    )
    
    source_labels = {
        "bank_transfer": "Bank Transfer Deposit",
        "card_deposit": "Card Deposit",
        "quick_topup": "Quick Top-up",
    }
    desc = deposit.description or source_labels.get(deposit.source, "Deposit")
    
    transaction = Transaction(
        user_id=current_user.id,
        to_account_id=deposit.account_id,
        amount=deposit.amount,
        transaction_type="deposit",
        description=desc,
        recipient_name="Self",
        status="completed",
    )
    await db.transactions.insert_one(transaction.dict())
    
    acc_type = account.get("account_type", "account").title()
    await create_notification(
        current_user.id,
        "Money Added",
        f"£{deposit.amount:.2f} added to your {acc_type} Account via {source_labels.get(deposit.source, deposit.source)}",
        "deposit",
        {"transaction_id": transaction.id, "amount": deposit.amount}
    )
    
    return {"message": "Deposit successful", "new_balance": account["balance"] + deposit.amount, "transaction_id": transaction.id}

# ==================== INTER-ACCOUNT TRANSFER ====================

class MoveMoneyRequest(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float
    description: str = ""

@api_router.post("/move-money")
async def move_money(req: MoveMoneyRequest, current_user: User = Depends(get_current_user)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if req.from_account_id == req.to_account_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")
    
    from_acc = await db.accounts.find_one({"id": req.from_account_id, "user_id": current_user.id})
    to_acc = await db.accounts.find_one({"id": req.to_account_id, "user_id": current_user.id})
    
    if not from_acc or not to_acc:
        raise HTTPException(status_code=404, detail="Account not found")
    if from_acc["balance"] < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    # Debit source, credit destination
    await db.accounts.update_one({"id": req.from_account_id}, {"$inc": {"balance": -req.amount}})
    await db.accounts.update_one({"id": req.to_account_id}, {"$inc": {"balance": req.amount}})
    
    from_type = from_acc.get("account_type", "").title()
    to_type = to_acc.get("account_type", "").title()
    desc = req.description or f"Move from {from_type} to {to_type}"
    
    txn = Transaction(
        user_id=current_user.id,
        from_account_id=req.from_account_id,
        to_account_id=req.to_account_id,
        amount=req.amount,
        transaction_type="transfer",
        description=desc,
        recipient_name=f"Own {to_type} Account",
    )
    await db.transactions.insert_one(txn.dict())
    
    await create_notification(
        current_user.id,
        "Money Moved",
        f"£{req.amount:.2f} moved from {from_type} to {to_type}",
        "transfer",
        {"transaction_id": txn.id, "amount": req.amount}
    )
    
    new_from = from_acc["balance"] - req.amount
    new_to = to_acc["balance"] + req.amount
    return {"message": "Transfer successful", "from_balance": new_from, "to_balance": new_to, "transaction_id": txn.id}

# ==================== SCHEDULED DEPOSITS ====================

class ScheduledDeposit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    account_id: str
    amount: float
    source: str = "quick_topup"
    frequency: str  # weekly, monthly
    next_run: datetime
    end_date: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ScheduleCreateRequest(BaseModel):
    account_id: str
    amount: float
    source: str = "quick_topup"
    frequency: str  # weekly, monthly
    start_date: Optional[str] = None  # ISO date string
    end_date: Optional[str] = None

@api_router.post("/schedules")
async def create_schedule(req: ScheduleCreateRequest, current_user: User = Depends(get_current_user)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if req.frequency not in ("weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Frequency must be weekly or monthly")
    
    account = await db.accounts.find_one({"id": req.account_id, "user_id": current_user.id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    next_run = datetime.utcnow()
    if req.start_date:
        try:
            next_run = datetime.fromisoformat(req.start_date.replace("Z", "+00:00")).replace(tzinfo=None)
        except:
            next_run = datetime.utcnow()
    
    end_date = None
    if req.end_date:
        try:
            end_date = datetime.fromisoformat(req.end_date.replace("Z", "+00:00")).replace(tzinfo=None)
        except:
            pass
    
    schedule = ScheduledDeposit(
        user_id=current_user.id,
        account_id=req.account_id,
        amount=req.amount,
        source=req.source,
        frequency=req.frequency,
        next_run=next_run,
        end_date=end_date,
    )
    await db.schedules.insert_one(schedule.dict())
    
    acc_type = account.get("account_type", "").title()
    await create_notification(
        current_user.id,
        "Schedule Created",
        f"£{req.amount:.2f} {req.frequency} deposit to {acc_type} Account",
        "system",
    )
    
    result = schedule.dict()
    result["next_run"] = result["next_run"].isoformat()
    result["created_at"] = result["created_at"].isoformat()
    if result.get("end_date"):
        result["end_date"] = result["end_date"].isoformat()
    return result

@api_router.get("/schedules")
async def get_schedules(current_user: User = Depends(get_current_user)):
    schedules = await db.schedules.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Process any due schedules
    now = datetime.utcnow()
    for sched in schedules:
        if sched.get("is_active") and sched.get("next_run"):
            next_run = sched["next_run"]
            if isinstance(next_run, datetime) and next_run <= now:
                # Execute the deposit
                account = await db.accounts.find_one({"id": sched["account_id"]})
                if account:
                    await db.accounts.update_one({"id": sched["account_id"]}, {"$inc": {"balance": sched["amount"]}})
                    txn = Transaction(
                        user_id=current_user.id,
                        to_account_id=sched["account_id"],
                        amount=sched["amount"],
                        transaction_type="deposit",
                        description=f"Scheduled {sched['frequency']} deposit",
                        recipient_name="Self",
                    )
                    await db.transactions.insert_one(txn.dict())
                
                # Advance next_run
                if sched["frequency"] == "weekly":
                    new_next = next_run + timedelta(weeks=1)
                else:
                    new_next = next_run + timedelta(days=30)
                
                # Check end date
                if sched.get("end_date") and isinstance(sched["end_date"], datetime) and new_next > sched["end_date"]:
                    await db.schedules.update_one({"id": sched["id"]}, {"$set": {"is_active": False, "next_run": new_next}})
                else:
                    await db.schedules.update_one({"id": sched["id"]}, {"$set": {"next_run": new_next}})
    
    # Re-fetch after processing
    schedules = await db.schedules.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return schedules

@api_router.delete("/schedules/{schedule_id}")
async def cancel_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    result = await db.schedules.delete_one({"id": schedule_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule cancelled"}

@api_router.post("/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    sched = await db.schedules.find_one({"id": schedule_id, "user_id": current_user.id})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    new_status = not sched.get("is_active", True)
    await db.schedules.update_one({"id": schedule_id}, {"$set": {"is_active": new_status}})
    return {"message": f"Schedule {'activated' if new_status else 'paused'}", "is_active": new_status}

# ==================== PAYEE MANAGEMENT ====================

class PayeeCreate(BaseModel):
    name: str
    sort_code: str
    account_number: str

class PayeeUpdate(BaseModel):
    name: Optional[str] = None
    sort_code: Optional[str] = None
    account_number: Optional[str] = None

@api_router.post("/payees")
async def create_payee(payee_data: PayeeCreate, current_user: User = Depends(get_current_user)):
    # Check for duplicate
    existing = await db.payees.find_one({
        "user_id": current_user.id,
        "account_number": payee_data.account_number,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Payee with this account number already exists")
    
    payee = Payee(
        user_id=current_user.id,
        name=payee_data.name,
        sort_code=payee_data.sort_code,
        account_number=payee_data.account_number,
    )
    await db.payees.insert_one(payee.dict())
    return {k: v for k, v in payee.dict().items() if k != "_id"}

@api_router.put("/payees/{payee_id}")
async def update_payee(payee_id: str, payee_data: PayeeUpdate, current_user: User = Depends(get_current_user)):
    update_fields = {k: v for k, v in payee_data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.payees.update_one(
        {"id": payee_id, "user_id": current_user.id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payee not found")
    
    updated = await db.payees.find_one({"id": payee_id}, {"_id": 0})
    return updated

# ==================== SPENDING ANALYTICS ====================

@api_router.get("/analytics/spending")
async def get_spending_analytics(current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # All transactions for this month
    monthly_txns = await db.transactions.find({
        "user_id": current_user.id,
        "transaction_type": {"$in": ["transfer", "payment"]},
        "timestamp": {"$gte": start_of_month}
    }).to_list(1000)
    
    # Category breakdown
    categories = {}
    for txn in monthly_txns:
        cat = txn.get("transaction_type", "other")
        if cat == "payment":
            desc = txn.get("description", "")
            if "Electric" in desc or "Water" in desc or "Gas" in desc:
                cat = "Utilities"
            elif "Internet" in desc or "Cable" in desc:
                cat = "Internet & TV"
            elif "Mobile" in desc or "Phone" in desc:
                cat = "Phone"
            elif "Insurance" in desc:
                cat = "Insurance"
            elif "Credit Card" in desc:
                cat = "Credit Card"
            else:
                cat = "Bills"
        elif cat == "transfer":
            cat = "Transfers"
        
        if cat not in categories:
            categories[cat] = {"total": 0, "count": 0}
        categories[cat]["total"] += txn["amount"]
        categories[cat]["count"] += 1
    
    # Top payees
    payee_totals = {}
    for txn in monthly_txns:
        name = txn.get("recipient_name", "Unknown")
        if name not in payee_totals:
            payee_totals[name] = 0
        payee_totals[name] += txn["amount"]
    
    top_payees = sorted(payee_totals.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Monthly totals for last 6 months
    monthly_totals = []
    for i in range(6):
        month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            month_end = now
        else:
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            month_end = next_month
        
        month_txns = await db.transactions.find({
            "user_id": current_user.id,
            "transaction_type": {"$in": ["transfer", "payment"]},
            "timestamp": {"$gte": month_start, "$lt": month_end}
        }).to_list(1000)
        
        total = sum(t["amount"] for t in month_txns)
        monthly_totals.append({
            "month": month_start.strftime("%b"),
            "year": month_start.year,
            "total": total,
            "count": len(month_txns),
        })
    
    total_spending = sum(txn["amount"] for txn in monthly_txns)
    
    return {
        "total_spending": total_spending,
        "transaction_count": len(monthly_txns),
        "categories": [{"name": k, "total": v["total"], "count": v["count"]} for k, v in sorted(categories.items(), key=lambda x: x[1]["total"], reverse=True)],
        "top_payees": [{"name": n, "total": t} for n, t in top_payees],
        "monthly_trend": list(reversed(monthly_totals)),
    }

# ==================== AI CHAT ====================

from emergentintegrations.llm.chat import LlmChat, UserMessage

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

@api_router.post("/chat")
async def chat_with_ai(chat_req: ChatRequest, current_user: User = Depends(get_current_user)):
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Gather user's financial context
    accounts = await db.accounts.find({"user_id": current_user.id}).to_list(100)
    total_balance = sum(acc["balance"] for acc in accounts)
    
    recent_txns = await db.transactions.find({"user_id": current_user.id}).sort("timestamp", -1).to_list(10)
    
    txn_summary = ""
    for txn in recent_txns:
        txn_type = txn.get("transaction_type", "unknown")
        amount = txn.get("amount", 0)
        desc = txn.get("description", "")
        recipient = txn.get("recipient_name", "")
        ts = txn.get("timestamp", datetime.utcnow())
        if isinstance(ts, datetime):
            ts_str = ts.strftime("%b %d, %Y at %I:%M %p")
        else:
            ts_str = str(ts)
        txn_summary += f"- {txn_type.title()}: £{amount:.2f} to {recipient or 'N/A'} ({desc}) on {ts_str}\n"
    
    accounts_summary = ""
    for acc in accounts:
        acc_type = acc.get("account_type", "unknown").title()
        balance = acc.get("balance", 0)
        acc_num = acc.get("account_number", "")
        accounts_summary += f"- {acc_type} Account (****{acc_num[-4:]}): £{balance:.2f}\n"
    
    system_msg = f"""You are Ellie, HSBC's friendly AI Banking Assistant. You are helpful, warm, professional, and concise.
You have access to the customer's financial information:

**Customer:** {current_user.name}
**Total Balance:** £{total_balance:.2f}

**Accounts:**
{accounts_summary}

**Recent Transactions (last 10):**
{txn_summary if txn_summary else "No recent transactions."}

**Guidelines:**
- Always use £ (GBP) for all amounts.
- Answer questions about their accounts, transactions, and banking.
- For "Last Transaction" queries, provide full details of their most recent transaction.
- For "Transfer Delays" queries, explain that domestic transfers typically take 1-2 business days, international 3-5 business days, and same-day transfers are available for urgent payments before 2 PM.
- For "Support Hours" queries, explain HSBC support is available 24/7 via phone (1-800-HSBC), Mon-Fri 8AM-8PM via live chat, and branches are open Mon-Fri 9AM-5PM, Sat 9AM-1PM.
- Be specific with numbers and dates when discussing transactions.
- Keep responses concise but comprehensive.
- Sign off as "Ellie" when appropriate.
- If asked about something you don't have data for, say so politely."""

    session_id = chat_req.session_id or f"chat-{current_user.id}-{uuid.uuid4()}"
    
    # Store message in DB
    await db.chat_messages.insert_one({
        "user_id": current_user.id,
        "session_id": session_id,
        "role": "user",
        "content": chat_req.message,
        "timestamp": datetime.utcnow(),
    })
    
    # Get chat history for context
    history = await db.chat_messages.find({
        "user_id": current_user.id,
        "session_id": session_id,
    }).sort("timestamp", 1).to_list(20)
    
    try:
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=system_msg,
        ).with_model("openai", "gpt-4.1-mini")
        
        # Replay history
        for msg in history[:-1]:  # Exclude current message (already in LlmChat)
            if msg["role"] == "user":
                user_msg = UserMessage(text=msg["content"])
                await chat.send_message(user_msg)
        
        # Send current message
        user_msg = UserMessage(text=chat_req.message)
        response = await chat.send_message(user_msg)
        
        # Store response
        await db.chat_messages.insert_one({
            "user_id": current_user.id,
            "session_id": session_id,
            "role": "assistant",
            "content": response,
            "timestamp": datetime.utcnow(),
        })
        
        return {"response": response, "session_id": session_id}
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.get("/chat/history")
async def get_chat_history(current_user: User = Depends(get_current_user), session_id: Optional[str] = None):
    query = {"user_id": current_user.id}
    if session_id:
        query["session_id"] = session_id
    
    messages = await db.chat_messages.find(query, {"_id": 0}).sort("timestamp", 1).to_list(50)
    return messages

# ==================== NOTIFICATIONS ====================

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    body: str
    notification_type: str  # transfer, payment, card, welcome, system
    is_read: bool = False
    data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

async def create_notification(user_id: str, title: str, body: str, notification_type: str, data: Optional[dict] = None):
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data,
    )
    await db.notifications.insert_one(notif.dict())
    return notif

@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user), limit: int = 30):
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user.id, "is_read": False})
    return {"count": count}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_read(current_user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All marked as read"}

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
