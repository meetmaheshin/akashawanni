# VoiceAI Backend with Call History & Transcript Management
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect, File, UploadFile, Depends, HTTPException, status, Body
from fastapi.responses import Response, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream
from twilio.rest import Client
import openai
from openai import OpenAI
from groq import Groq
import os, io
import faiss
import numpy as np
import json
import base64
import asyncio
from dotenv import load_dotenv
import audioop
import time
import traceback
from sarvamai import AsyncSarvamAI, AudioOutput, EventResponse
from functools import lru_cache
from deepgram import DeepgramClient
from deepgram.core.events import EventType as LiveTranscriptionEvents
import threading
import websockets
from websockets.protocol import State
from contextlib import asynccontextmanager
from sentence_transformers import SentenceTransformer
from datetime import datetime
from database import connect_to_mongodb, close_mongodb_connection, get_call_history_db, CallHistoryDB
from campaigns import get_campaign_db, CampaignDB
from users import get_user_db, initialize_user_db, create_admin_user, UserDB
from auth import create_access_token, get_current_active_user, get_admin_user, is_admin
from wallet import get_wallet_db, initialize_wallet_db
from transactions import get_transaction_db, initialize_transaction_db
from payments import PaymentService
from typing import Optional
import shutil
import aiofiles
from pydantic import BaseModel, EmailStr


load_dotenv(override=False)

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
SERVER_URL = os.getenv("SERVER_URL", "https://akashawanni-production.up.railway.app")
print(f"[STARTUP] SERVER_URL={SERVER_URL}")
print(f"[STARTUP] WebSocket URL will be: {SERVER_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/media-stream")

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Initialize Sentence Transformer for embeddings (free, local, fast)
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')  # 384 dimensions, very fast

# Groq Configuration for ultra-fast LLM inference
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

groq_client = Groq(api_key=GROQ_API_KEY)

# Deepgram Configuration for ultra-low latency STT
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    raise ValueError("DEEPGRAM_API_KEY environment variable is required")

deepgram_client = DeepgramClient(api_key=DEEPGRAM_API_KEY)

# Cartesia TTS Configuration for ultra-fast voice synthesis
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY")
CARTESIA_ENG_VOICE_ID = os.getenv("CARTESIA_ENG_VOICE_ID", "7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8")
CARTESIA_HINDI_VOICE_ID = os.getenv("CARTESIA_HINDI_VOICE_ID", "47f3bbb1-e98f-4e0c-92c5-5f0325e1e206")

if not CARTESIA_API_KEY:
    raise ValueError("CARTESIA_API_KEY environment variable is required")

# Sarvam TTS Configuration for Indian language voice synthesis
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_HINDI_SPEAKER = os.getenv("SARVAM_HINDI_SPEAKER", "anushka")
SARVAM_MODEL = "bulbul:v2"

if SARVAM_API_KEY:
    print(f"[STARTUP] Sarvam TTS enabled: model={SARVAM_MODEL}, speaker={SARVAM_HINDI_SPEAKER}")
else:
    print("[STARTUP] Sarvam TTS not configured, Hindi will use Cartesia")

# Language configuration
LANGUAGE_CONFIG = {
    "en": {
        "voice_id": CARTESIA_ENG_VOICE_ID,
        "deepgram_language": "en",
        "name": "English",
        "tts_engine": "cartesia"
    },
    "hi": {
        "voice_id": CARTESIA_HINDI_VOICE_ID,
        "deepgram_language": "hi",
        "name": "Hindi",
        "tts_engine": "sarvam" if SARVAM_API_KEY else "cartesia"
    }
}

# Knowledge Base Configuration
KB_DIRECTORY = "knowledge_bases"
kb_cache = {}
embedding_cache = {}  # NEW: Cache embeddings to avoid repeated API calls

# Global WebSocket Connection Manager
class ConnectionManager:
    """Manages per-call Deepgram and Cartesia WebSocket connections for parallel processing"""
    def __init__(self):
        self.deepgram_connections = {}  # call_id -> connection
        self.cartesia_connections = {}  # call_id -> websocket
        self.sarvam_connections = {}    # call_id -> AsyncSarvamAI streaming ws
        self.is_initialized = False
    
    async def create_cartesia_connection(self, call_id: str):
        """Create a new Cartesia WebSocket connection for a specific call"""
        try:
            cartesia_url = f"wss://api.cartesia.ai/tts/websocket?api_key={CARTESIA_API_KEY}&cartesia_version=2024-06-10"
            cartesia_ws = await websockets.connect(cartesia_url)
            self.cartesia_connections[call_id] = cartesia_ws
            print(f"✓ Cartesia WebSocket created for call: {call_id}")
            return cartesia_ws
        except Exception as e:
            print(f"✗ Failed to connect to Cartesia for call {call_id}: {e}")
            return None
    
    def get_cartesia_connection(self, call_id: str):
        """Get Cartesia WebSocket for a specific call"""
        return self.cartesia_connections.get(call_id)
    
    def create_deepgram_connection(self, call_id: str, language: str = "en"):
        """Create a new Deepgram connection for a specific call"""
        try:
            dg_connection_manager = deepgram_client.listen.v1.connect(
                model="nova-2",
                language=language,
                smart_format=True,
                encoding="mulaw",
                sample_rate=8000,
                channels=1,
                interim_results=True,
                endpointing=300,
                utterance_end_ms=1000,
                vad_events=True,
            )
            
            dg_connection = dg_connection_manager.__enter__()
            self.deepgram_connections[call_id] = {
                'connection': dg_connection,
                'manager': dg_connection_manager
            }
            print(f"✓ Deepgram connection created for call: {call_id}")
            return dg_connection
        except Exception as e:
            print(f"✗ Failed to create Deepgram connection: {e}")
            return None
    
    def cleanup_deepgram(self, call_id: str):
        """Cleanup Deepgram connection for a specific call"""
        if call_id in self.deepgram_connections:
            try:
                conn_data = self.deepgram_connections[call_id]
                try:
                    conn_data['connection']._websocket.close()
                except:
                    pass
                try:
                    conn_data['manager'].__exit__(None, None, None)
                except:
                    pass
                del self.deepgram_connections[call_id]
                print(f"✓ Deepgram connection cleaned up for call: {call_id}")
            except Exception as e:
                print(f"✗ Error cleaning up Deepgram: {e}")
    
    async def cleanup_cartesia(self, call_id: str):
        """Cleanup Cartesia connection for a specific call"""
        if call_id in self.cartesia_connections:
            try:
                cartesia_ws = self.cartesia_connections[call_id]
                await cartesia_ws.close()
                del self.cartesia_connections[call_id]
                print(f"✓ Cartesia connection cleaned up for call: {call_id}")
            except Exception as e:
                print(f"✗ Error cleaning up Cartesia: {e}")

    async def create_sarvam_client(self, call_id: str):
        """Create a Sarvam AI client for a specific call"""
        if not SARVAM_API_KEY:
            print(f"✗ Sarvam API key not configured")
            return None
        try:
            client = AsyncSarvamAI(api_subscription_key=SARVAM_API_KEY)
            self.sarvam_connections[call_id] = client
            print(f"✓ Sarvam client created for call: {call_id}")
            return client
        except Exception as e:
            print(f"✗ Failed to create Sarvam client for call {call_id}: {e}")
            return None

    def get_sarvam_client(self, call_id: str):
        """Get Sarvam client for a specific call"""
        return self.sarvam_connections.get(call_id)

    async def cleanup_sarvam(self, call_id: str):
        """Cleanup Sarvam connection for a specific call"""
        if call_id in self.sarvam_connections:
            try:
                del self.sarvam_connections[call_id]
                print(f"✓ Sarvam client cleaned up for call: {call_id}")
            except Exception as e:
                print(f"✗ Error cleaning up Sarvam: {e}")

# Initialize global connection manager
connection_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for FastAPI startup/shutdown"""
    # Startup
    os.makedirs(KB_DIRECTORY, exist_ok=True)
    
    # Initialize MongoDB connection
    await connect_to_mongodb()
    print("✓ MongoDB connected")
    
    # Initialize user database and create admin
    from database import get_database
    db = get_database()
    await initialize_user_db(db)
    await create_admin_user()
    
    # Initialize wallet and transaction databases
    await initialize_wallet_db()
    await initialize_transaction_db()
    print("✓ Wallet and transaction databases initialized")
    
    # Pre-initialize knowledge base
    try:
        initialize_kb("Akashvanni")
        print("✓ KB pre-loaded")
    except Exception as e:
        print(f"Warning: Could not pre-load KB: {e}")
    
    print("✓ All connections ready (per-call Deepgram + Cartesia)")
    
    yield
    
    # Shutdown - close MongoDB connection
    await close_mongodb_connection()


app = FastAPI(lifespan=lifespan)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_kb_from_file(kb_id: str):
    """Load knowledge base text from file"""
    kb_file = os.path.join(KB_DIRECTORY, f"{kb_id}.txt")
    if not os.path.exists(kb_file):
        raise FileNotFoundError(f"Knowledge base file '{kb_file}' not found")
    
    with open(kb_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    kb_texts = [line.strip() for line in content.split('\n') if line.strip()]
    if not kb_texts:
        raise ValueError(f"Knowledge base file '{kb_file}' is empty")
    
    return kb_texts

def initialize_kb(kb_id: str):
    """Initialize and cache a knowledge base from file"""
    if kb_id in kb_cache:
        return
    
    kb_texts = load_kb_from_file(kb_id)
    dimension = 384  # all-MiniLM-L6-v2 produces 384-dim embeddings
    index = faiss.IndexFlatL2(dimension)
    
    # Batch embeddings for faster initialization using sentence transformers
    embeddings = embedding_model.encode(kb_texts, convert_to_numpy=True)
    emb_array = embeddings.astype('float32')
    index.add(emb_array)
    
    kb_cache[kb_id] = {
        "index": index,
        "texts": kb_texts
    }
    
    print(f"✓ Initialized KB: {kb_id} ({len(kb_texts)} entries)")

def load_kb(kb_id: str):
    """Load a specific knowledge base from cache"""
    if kb_id not in kb_cache:
        initialize_kb(kb_id)
    return kb_cache[kb_id]

@lru_cache(maxsize=100)
def get_embedding_cached(query: str):
    """Cache embeddings for repeated queries - MASSIVE speedup"""
    return embedding_model.encode(query, convert_to_numpy=True)

def get_kb_context_fast(kb_id: str, query: str, top_k: int = 2):
    """OPTIMIZED: Faster KB context retrieval with caching"""
    if not kb_id or kb_id == "general":
        return None
    
    kb = load_kb(kb_id)
    
    # Use cached embeddings
    query_lower = query.lower().strip()
    embedding = get_embedding_cached(query_lower)
    
    query_emb = np.array([embedding]).astype('float32')
    
    _, indices = kb["index"].search(query_emb, top_k)
    kb_texts = kb["texts"]
    
    # Return only first 300 chars of each result (truncate for speed)
    context_parts = [kb_texts[i][:300] for i in indices[0]]
    context = "\n".join(context_parts)
    
    return context

@app.post("/api/upload-knowledge-base")
async def upload_knowledge_base(file: UploadFile = File(...)):
    """Upload a knowledge base text file"""
    try:
        if not file.filename.endswith('.txt'):
            raise HTTPException(status_code=400, detail="Only .txt files are allowed")
        
        # Generate unique KB ID from filename
        kb_id = file.filename.replace('.txt', '').replace(' ', '_').lower()
        kb_path = os.path.join(KB_DIRECTORY, f"{kb_id}.txt")
        
        # Save file
        async with aiofiles.open(kb_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Initialize KB in cache
        initialize_kb(kb_id)
        
        return JSONResponse({
            "status": "success",
            "kb_id": kb_id,
            "filename": file.filename,
            "message": f"Knowledge base '{kb_id}' uploaded and initialized"
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/knowledge-bases")
async def list_knowledge_bases():
    """List all available knowledge bases"""
    try:
        kb_files = [f.replace('.txt', '') for f in os.listdir(KB_DIRECTORY) if f.endswith('.txt')]
        return JSONResponse({
            "knowledge_bases": kb_files
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str


@app.post("/api/auth/signup")
async def signup(request: SignupRequest):
    """Register a new user — sends verification email"""
    try:
        user_db = get_user_db()

        # Check if user already exists
        existing_user = await user_db.get_user_by_email(request.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Generate verification code
        from email_service import generate_verification_code, send_verification_email
        code = generate_verification_code()

        # Create new user (inactive until verified)
        user = await user_db.create_user(
            email=request.email,
            password=request.password,
            name=request.name,
            role="user",
            verification_code=code
        )

        # Send verification email
        send_verification_email(request.email, code, request.name)

        return JSONResponse({
            "status": "verification_required",
            "message": "Verification code sent to your email",
            "email": request.email
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/verify-email")
async def verify_email(request: dict = Body(...)):
    """Verify email with 6-digit code"""
    try:
        email = request.get("email")
        code = request.get("code")

        if not email or not code:
            raise HTTPException(status_code=400, detail="Email and code are required")

        user_db = get_user_db()
        user = await user_db.verify_email_code(email, code)

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        # Send welcome email
        from email_service import send_welcome_email
        send_welcome_email(email, user.get("name", "User"))

        # Create access token
        access_token = create_access_token(data={"sub": user["_id"]})

        return JSONResponse({
            "status": "success",
            "message": "Email verified successfully",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["_id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"]
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/resend-verification")
async def resend_verification(request: dict = Body(...)):
    """Resend verification code"""
    try:
        email = request.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        user_db = get_user_db()
        from email_service import generate_verification_code, send_verification_email

        code = generate_verification_code()
        updated = await user_db.resend_verification_code(email, code)

        if not updated:
            raise HTTPException(status_code=400, detail="Could not resend code. Account may already be verified.")

        # Get user name for email
        user = await user_db.get_user_by_email(email)
        user_name = user.get("name", "User") if user else "User"

        send_verification_email(email, code, user_name)

        return JSONResponse({
            "status": "success",
            "message": "New verification code sent"
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """Login user"""
    try:
        user_db = get_user_db()

        # Authenticate user
        user = await user_db.authenticate_user(request.email, request.password)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # If email not verified, send a new code and ask to verify
        if not user.get("email_verified", True):
            from email_service import generate_verification_code, send_verification_email
            code = generate_verification_code()
            await user_db.resend_verification_code(request.email, code)
            send_verification_email(request.email, code, user.get("name", "User"))

            return JSONResponse({
                "status": "verification_required",
                "message": "Please verify your email first. A new code has been sent.",
                "email": request.email
            })

        # Create access token
        access_token = create_access_token(data={"sub": user["_id"]})

        return JSONResponse({
            "status": "success",
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["_id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"]
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current user information with wallet balance"""
    # Get wallet balance
    wallet_db = get_wallet_db()
    balance = await wallet_db.get_balance(current_user["_id"])

    return JSONResponse({
        "id": current_user["_id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "wallet_balance": balance,
        "phone": current_user.get("phone", ""),
        "company_name": current_user.get("company_name", ""),
        "gstin": current_user.get("gstin", ""),
        "company_address": current_user.get("company_address", "")
    })


@app.put("/api/auth/profile")
async def update_profile(request: dict = Body(...), current_user: dict = Depends(get_current_active_user)):
    """Update user profile"""
    try:
        user_db = get_user_db()

        update_data = {}
        for field in ["name", "phone", "company_name", "gstin", "company_address"]:
            if field in request:
                update_data[field] = request[field]

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        success = await user_db.update_user(current_user["_id"], update_data)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update profile")

        return JSONResponse({"status": "success", "message": "Profile updated"})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users")
async def get_all_users(
    current_user: dict = Depends(get_admin_user),
    limit: int = 100,
    offset: int = 0
):
    """Get all users (admin only)"""
    try:
        user_db = get_user_db()
        users = await user_db.get_all_users(limit=limit, skip=offset)
        total = await user_db.get_total_users_count()
        
        return JSONResponse({
            "users": users,
            "total": total,
            "limit": limit,
            "offset": offset
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# END AUTHENTICATION ENDPOINTS
# ============================================================================


# ============================================================================
# WALLET & PAYMENT ENDPOINTS
# ============================================================================

@app.get("/api/wallet/balance")
async def get_wallet_balance(current_user: dict = Depends(get_current_active_user)):
    """Get current wallet balance"""
    try:
        wallet_db = get_wallet_db()
        balance = await wallet_db.get_balance(current_user["_id"])
        
        return JSONResponse({
            "balance": balance,
            "currency": "INR"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/wallet/call-rate")
async def get_call_rate():
    """Get current call rate per minute"""
    try:
        wallet_db = get_wallet_db()
        rate = await wallet_db.get_call_rate_per_minute()
        
        return JSONResponse({
            "rate_per_minute": rate,
            "currency": "INR"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/wallet/set-call-rate")
async def set_call_rate(
    rate: float,
    current_user: dict = Depends(get_admin_user)
):
    """Set call rate per minute (admin only)"""
    try:
        if rate <= 0:
            raise HTTPException(status_code=400, detail="Rate must be positive")
        
        wallet_db = get_wallet_db()
        await wallet_db.set_call_rate_per_minute(rate)
        
        return JSONResponse({
            "status": "success",
            "message": f"Call rate updated to Rs. {rate} per minute",
            "rate_per_minute": rate
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateOrderRequest(BaseModel):
    amount: float


class PaymentVerificationRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount: float


@app.get("/api/payment/razorpay-key")
async def get_razorpay_key():
    """Get Razorpay key for frontend integration"""
    try:
        if not PaymentService.is_configured():
            raise HTTPException(
                status_code=503,
                detail="Payment service is not configured. Please contact administrator."
            )
        
        key = PaymentService.get_razorpay_key()
        return JSONResponse({"razorpay_key": key})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payment/create-order")
async def create_payment_order(
    request: CreateOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create Razorpay order for wallet recharge"""
    try:
        if not PaymentService.is_configured():
            raise HTTPException(
                status_code=503,
                detail="Payment service is not configured. Please contact administrator."
            )
        
        # Validate minimum amount
        if request.amount < PaymentService.MINIMUM_AMOUNT:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum recharge amount is Rs. {PaymentService.MINIMUM_AMOUNT}"
            )
        
        # Create Razorpay order
        order = await PaymentService.create_order(
            amount=request.amount,
            user_id=current_user["_id"]
        )
        
        return JSONResponse({
            "status": "success",
            "order": order
        })
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payment/verify")
async def verify_payment(
    request: PaymentVerificationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Verify Razorpay payment and credit wallet"""
    try:
        if not PaymentService.is_configured():
            raise HTTPException(
                status_code=503,
                detail="Payment service is not configured"
            )
        
        # Verify payment signature
        is_valid = PaymentService.verify_payment_signature(
            razorpay_order_id=request.razorpay_order_id,
            razorpay_payment_id=request.razorpay_payment_id,
            razorpay_signature=request.razorpay_signature
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail="Invalid payment signature"
            )
        
        # Check if payment already processed
        transaction_db = get_transaction_db()
        existing_txn = await transaction_db.get_transaction_by_payment_id(
            request.razorpay_payment_id
        )
        
        if existing_txn:
            raise HTTPException(
                status_code=400,
                detail="Payment already processed"
            )
        
        # GST calculation: total paid includes 18% GST
        total_amount = request.amount
        base_amount = round(total_amount / 1.18, 2)
        gst_amount = round(total_amount - base_amount, 2)

        # Credit wallet with base amount (excluding GST)
        wallet_db = get_wallet_db()
        new_balance = await wallet_db.add_funds(
            user_id=current_user["_id"],
            amount=base_amount,
            transaction_id=request.razorpay_payment_id
        )

        # Generate invoice first so we can store invoice_id in transaction
        invoice_id = None
        try:
            from invoices import get_invoice_db
            invoice_db = get_invoice_db()
            invoice = await invoice_db.create_invoice(
                user_id=current_user["_id"],
                transaction_id=request.razorpay_payment_id,
                payment_id=request.razorpay_payment_id,
                total_amount=total_amount,
                base_amount=base_amount,
                gst_amount=gst_amount,
                buyer_name=current_user.get("name", ""),
                buyer_email=current_user.get("email", ""),
                buyer_gstin=current_user.get("gstin", ""),
                buyer_address=current_user.get("company_address", "")
            )
            invoice_id = invoice["_id"]
        except Exception as inv_err:
            print(f"Warning: Invoice creation failed: {inv_err}")

        # Create transaction record
        await transaction_db.create_transaction(
            user_id=current_user["_id"],
            transaction_type="credit",
            amount=base_amount,
            description=f"Wallet recharge via Razorpay (₹{total_amount:.2f} incl. GST ₹{gst_amount:.2f})",
            payment_id=request.razorpay_payment_id,
            payment_method="razorpay",
            metadata={
                "order_id": request.razorpay_order_id,
                "total_amount": total_amount,
                "base_amount": base_amount,
                "gst_amount": gst_amount,
                "invoice_id": invoice_id
            }
        )

        return JSONResponse({
            "status": "success",
            "message": f"₹{base_amount:.2f} credited to wallet (₹{gst_amount:.2f} GST)",
            "new_balance": new_balance,
            "total_paid": total_amount,
            "wallet_credit": base_amount,
            "gst": gst_amount,
            "invoice_id": invoice_id
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INVOICE ENDPOINTS
# ============================================================================

@app.get("/api/invoices")
async def get_invoices(current_user: dict = Depends(get_current_active_user)):
    """Get user's invoices"""
    try:
        from invoices import get_invoice_db
        invoice_db = get_invoice_db()
        invoices = await invoice_db.get_invoices_by_user(current_user["_id"])
        return JSONResponse({"invoices": invoices})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/invoices/{invoice_id}/download")
async def download_invoice(invoice_id: str, current_user: dict = Depends(get_current_active_user)):
    """Download invoice as HTML"""
    try:
        from invoices import get_invoice_db
        invoice_db = get_invoice_db()
        invoice = await invoice_db.get_invoice_by_id(invoice_id)

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        if invoice["user_id"] != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        html = invoice.get("invoice_html", "")
        return Response(
            content=html,
            media_type="text/html",
            headers={"Content-Disposition": f'inline; filename="invoice_{invoice["invoice_number"]}.html"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TRANSACTION ENDPOINTS
# ============================================================================

@app.get("/api/transactions")
async def get_transactions(
    transaction_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_active_user)
):
    """Get transaction history"""
    try:
        transaction_db = get_transaction_db()
        
        # Admin can see all transactions, users only see their own
        user_id = None if is_admin(current_user) else current_user["_id"]
        
        # Validate transaction type
        if transaction_type and transaction_type not in ["credit", "debit"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid transaction type. Must be 'credit' or 'debit'"
            )
        
        transactions = await transaction_db.get_transactions(
            user_id=user_id,
            transaction_type=transaction_type,
            limit=limit,
            skip=offset
        )
        
        total = await transaction_db.get_total_count(
            user_id=user_id,
            transaction_type=transaction_type
        )
        
        # Get summary if fetching user's own transactions
        summary = None
        if user_id:
            summary = await transaction_db.get_user_balance_summary(user_id)
        
        return JSONResponse({
            "transactions": transactions,
            "total": total,
            "limit": limit,
            "offset": offset,
            "summary": summary
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/transactions/download")
async def download_transactions(
    transaction_type: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Download transaction history as CSV"""
    import io
    
    try:
        transaction_db = get_transaction_db()
        
        # Admin can download all, users only their own
        user_id = None if is_admin(current_user) else current_user["_id"]
        
        # Get all transactions (no limit)
        transactions = await transaction_db.get_transactions(
            user_id=user_id,
            transaction_type=transaction_type,
            limit=10000,
            skip=0
        )
        
        # Build CSV content
        csv_lines = []
        csv_lines.append("Date,Type,Amount (Rs.),Description,Payment ID,Call SID,Campaign ID")
        
        for txn in transactions:
            date = txn.get("created_at", "")
            txn_type = txn.get("transaction_type", "").upper()
            amount = txn.get("amount", 0)
            description = txn.get("description", "").replace('"', '""')
            payment_id = txn.get("payment_id", "")
            call_sid = txn.get("call_sid", "")
            campaign_id = txn.get("campaign_id", "")
            
            csv_lines.append(f'"{date}","{txn_type}",{amount},"{description}","{payment_id}","{call_sid}","{campaign_id}"')
        
        csv_content = "\n".join(csv_lines)
        
        # Return as downloadable CSV
        filename = f"transactions_{current_user['name'].replace(' ', '_')}.csv" if user_id else "all_transactions.csv"
        
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# END WALLET & PAYMENT ENDPOINTS
# ============================================================================


@app.post("/voice/incoming")
async def handle_incoming_call(request: Request):
    """Handle incoming Twilio calls and set up Media Stream"""
    response = VoiceResponse()
    
    response.say(
        "Hello! I'm आरती from Akashvanni. How can I help you today?",
        voice="Polly.Joanna"
    )
    
    response.pause(length=1)
    
    connect = Connect()
    websocket_url = f'{SERVER_URL.replace("https://", "wss://").replace("http://", "ws://")}/ws/media-stream'
    stream = Stream(url=websocket_url)
    connect.append(stream)
    response.append(connect)
    
    response.pause(length=3600)
    
    return Response(content=str(response), media_type="application/xml")

# @app.post("/voice/outbound-twiml")
# async def outbound_twiml(kb_id: str = "Akashvanni"):
#     """Serve TwiML for outbound calls with media stream"""
#     response = VoiceResponse()
    
#     response.say(
#         "Hello! This is आरती from Akashvanni calling you.",
#         voice="Polly.Joanna"
#     )
    
#     response.pause(length=1)
    
#     connect = Connect()
#     server_url = "wss://kathlyn-clamatorial-manda.ngrok-free.dev"
#     websocket_url = f'{server_url}/ws/media-stream?kb_id={kb_id}'
#     stream = Stream(url=websocket_url)
#     connect.append(stream)
#     response.append(connect)
    
#     response.pause(length=3600)
    
#     return Response(content=str(response), media_type="application/xml")

@app.post("/api/call")
async def make_outbound_call(
    to_number: str,
    kb_id: str = "Akashvanni",
    kb_name: str = None,
    welcome_message: str = "Hello! This is आरती from Akashvanni calling you.",
    language: str = "en",
    tts_engine: str = "cartesia",
    tts_voice: str = "",
    current_user: dict = Depends(get_current_active_user)
):
    """Initiate outbound call and create call history record"""
    
    # Check wallet balance
    wallet_db = get_wallet_db()
    has_balance = await wallet_db.has_minimum_balance(current_user["_id"], minimum=10.0)
    
    if not has_balance:
        current_balance = await wallet_db.get_balance(current_user["_id"])
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient wallet balance. Current balance: Rs. {current_balance:.2f}. Minimum required: Rs. 10.00"
        )
    
    # Validate language
    if language not in LANGUAGE_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}. Supported: {list(LANGUAGE_CONFIG.keys())}")
    
    if not to_number:
        raise HTTPException(status_code=400, detail="to_number is required")
    
    # Verify KB exists
    try:
        initialize_kb(kb_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")
    
    server_url = SERVER_URL

    server_url = server_url.rstrip('/')

    websocket_url = f'{SERVER_URL.replace("https://", "wss://").replace("http://", "ws://")}/ws/media-stream'
    print(f"[CALL] SERVER_URL={SERVER_URL}")
    print(f"[CALL] WebSocket URL for Twilio: {websocket_url}")
    print(f"[CALL] Calling {to_number} with kb_id={kb_id}, language={language}")

    twiml = VoiceResponse()
    if language == 'en':
        twiml.say(welcome_message, voice="Polly.Joanna")
    elif language == 'hi':
        twiml.say(welcome_message, language="hi-IN")
    twiml.pause(length=1)

    connect = Connect()
    stream = Stream(url=websocket_url)
    
    # Add custom parameters that will be sent in the 'start' event
    stream.parameter(name='kb_id', value=kb_id)
    stream.parameter(name='language', value=language)
    stream.parameter(name='tts_engine', value=tts_engine)
    stream.parameter(name='tts_voice', value=tts_voice)
    
    connect.append(stream)
    twiml.append(connect)
    
    twiml.pause(length=3600)
    
    try:
        call = twilio_client.calls.create(
            to=to_number,
            from_=TWILIO_PHONE_NUMBER,
            twiml=str(twiml)
        )
        
        # Create call history record in MongoDB
        call_history_db = get_call_history_db()
        call_record = await call_history_db.create_call(
            call_sid=call.sid,
            phone_number=to_number,
            knowledge_base_id=kb_id,
            knowledge_base_name=kb_name or kb_id,
            status="initiated",
            user_id=current_user["_id"]
        )
        
        return {
            "status": "call_initiated",
            "call_sid": call.sid,
            "to": to_number,
            "websocket_url": websocket_url,
            "kb_id": kb_id,
            "call_history_id": call_record["_id"],
            "language": language
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/call-history")
async def get_call_history(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_active_user)
):
    """Get call history with pagination"""
    try:
        call_history_db = get_call_history_db()
        
        # Admin can see all calls, users only see their own
        user_id = None if is_admin(current_user) else current_user["_id"]
        
        calls = await call_history_db.get_call_history(
            limit=limit,
            skip=offset,
            user_id=user_id
        )
        
        total = await call_history_db.get_total_count(user_id=user_id)
        
        return JSONResponse({
            "calls": calls,
            "total": total,
            "limit": limit,
            "offset": offset
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/call-history/{call_sid}")
async def get_call_details(
    call_sid: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get detailed information about a specific call"""
    try:
        call_history_db = get_call_history_db()
        call = await call_history_db.get_call_by_sid(call_sid)
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Check authorization - users can only see their own calls, admin can see all
        if not is_admin(current_user) and call.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this call")
        
        return JSONResponse(call)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CAMPAIGN MANAGEMENT ENDPOINTS
# ============================================================================

@app.post("/api/campaigns")
async def create_campaign(
    name: str,
    phone_numbers: str,  # Comma-separated or newline-separated
    kb_id: str,
    kb_name: Optional[str] = None,
    welcome_message: str = "Hello! This is आरती from Akashvanni calling you.",
    language: str = "en",
    tts_engine: str = "cartesia",
    tts_voice: str = "",
    chunk_size: int = 10,
    retry_failed: bool = True,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new calling campaign"""
    try:
        # Check wallet balance
        wallet_db = get_wallet_db()
        has_balance = await wallet_db.has_minimum_balance(current_user["_id"], minimum=10.0)
        
        if not has_balance:
            current_balance = await wallet_db.get_balance(current_user["_id"])
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient wallet balance. Current balance: Rs. {current_balance:.2f}. Minimum required: Rs. 10.00"
            )
        
        # Parse phone numbers
        numbers_list = []
        if ',' in phone_numbers:
            numbers_list = [n.strip() for n in phone_numbers.split(',') if n.strip()]
        else:
            numbers_list = [n.strip() for n in phone_numbers.split('\n') if n.strip()]
        
        if not numbers_list:
            raise HTTPException(status_code=400, detail="No valid phone numbers provided")
        
        # Verify KB exists
        try:
            initialize_kb(kb_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")
        
        # Create campaign in database
        campaign_db = get_campaign_db()
        campaign = await campaign_db.create_campaign(
            name=name,
            phone_numbers=numbers_list,
            knowledge_base_id=kb_id,
            knowledge_base_name=kb_name or kb_id,
            welcome_message=welcome_message,
            language=language,
            chunk_size=chunk_size,
            retry_failed=retry_failed,
            user_id=current_user["_id"],
            tts_engine=tts_engine,
            tts_voice=tts_voice
        )

        # Start processing campaign in background
        asyncio.create_task(process_campaign(campaign["_id"]))

        return JSONResponse({
            "status": "success",
            "campaign_id": campaign["_id"],
            "total_numbers": len(numbers_list),
            "message": f"Campaign '{name}' created and processing started"
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/campaigns/upload")
async def create_campaign_with_file(
    file: UploadFile = File(...),
    name: str = None,
    kb_id: str = "Akashvanni",
    kb_name: Optional[str] = None,
    welcome_message: str = "Hello! This is आरती from Akashvanni calling you.",
    language: str = "en",
    tts_engine: str = "cartesia",
    tts_voice: str = "",
    chunk_size: int = 10,
    retry_failed: bool = True,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a campaign by uploading a file with phone numbers"""
    try:
        # Check wallet balance
        wallet_db = get_wallet_db()
        has_balance = await wallet_db.has_minimum_balance(current_user["_id"], minimum=10.0)
        
        if not has_balance:
            current_balance = await wallet_db.get_balance(current_user["_id"])
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient wallet balance. Current balance: Rs. {current_balance:.2f}. Minimum required: Rs. 10.00"
            )
        
        # Validate file type
        if not (file.filename.endswith('.txt') or file.filename.endswith('.csv')):
            raise HTTPException(status_code=400, detail="Only .txt and .csv files are allowed")
        
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Parse phone numbers (handles both comma and newline separators)
        numbers_list = []
        for line in content_str.split('\n'):
            line = line.strip()
            if ',' in line:
                numbers_list.extend([n.strip() for n in line.split(',') if n.strip()])
            elif line:
                numbers_list.append(line)
        
        # Remove duplicates while preserving order
        numbers_list = list(dict.fromkeys(numbers_list))
        
        if not numbers_list:
            raise HTTPException(status_code=400, detail="No valid phone numbers found in file")
        
        # Verify KB exists
        try:
            initialize_kb(kb_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")
        
        # Use filename as campaign name if not provided
        campaign_name = name or f"Campaign_{file.filename.replace('.txt', '').replace('.csv', '')}"
        
        # Create campaign in database
        campaign_db = get_campaign_db()
        campaign = await campaign_db.create_campaign(
            name=campaign_name,
            phone_numbers=numbers_list,
            knowledge_base_id=kb_id,
            knowledge_base_name=kb_name or kb_id,
            welcome_message=welcome_message,
            language=language,
            chunk_size=chunk_size,
            retry_failed=retry_failed,
            user_id=current_user["_id"],
            tts_engine=tts_engine,
            tts_voice=tts_voice
        )

        # Start processing campaign in background
        asyncio.create_task(process_campaign(campaign["_id"]))

        return JSONResponse({
            "status": "success",
            "campaign_id": campaign["_id"],
            "campaign_name": campaign_name,
            "total_numbers": len(numbers_list),
            "message": f"Campaign '{campaign_name}' created with {len(numbers_list)} numbers"
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/campaigns")
async def get_campaigns(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all campaigns with pagination"""
    try:
        campaign_db = get_campaign_db()
        
        # Admin can see all campaigns, users only see their own
        user_id = None if is_admin(current_user) else current_user["_id"]
        
        campaigns = await campaign_db.get_all_campaigns(limit=limit, skip=offset, user_id=user_id)
        total = await campaign_db.get_total_count(user_id=user_id)
        
        return JSONResponse({
            "campaigns": campaigns,
            "total": total,
            "limit": limit,
            "offset": offset
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign_details(
    campaign_id: str,
    include_calls: bool = True,
    current_user: dict = Depends(get_current_active_user)
):
    """Get detailed information about a specific campaign with call history"""
    try:
        campaign_db = get_campaign_db()
        call_history_db = get_call_history_db()
        
        campaign = await campaign_db.get_campaign(campaign_id)
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Check authorization - users can only see their own campaigns, admin can see all
        if not is_admin(current_user) and campaign.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this campaign")
        
        # Fetch detailed call history for this campaign
        if include_calls:
            call_details = await call_history_db.get_calls_by_campaign(campaign_id)
            campaign["call_details"] = call_details
        
        return JSONResponse(campaign)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/campaigns/{campaign_id}/retry")
async def retry_failed_calls(
    campaign_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Retry failed calls in a campaign"""
    try:
        campaign_db = get_campaign_db()
        campaign = await campaign_db.get_campaign(campaign_id)
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Check authorization
        if not is_admin(current_user) and campaign.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to retry this campaign")
        
        # Get failed numbers
        failed_calls = await campaign_db.get_failed_numbers(campaign_id)
        
        if not failed_calls:
            return JSONResponse({
                "status": "success",
                "message": "No failed calls to retry"
            })
        
        # Create retry campaign
        failed_numbers = [call["phone_number"] for call in failed_calls]
        retry_campaign = await campaign_db.create_campaign(
            name=f"{campaign['name']} (Retry)",
            phone_numbers=failed_numbers,
            knowledge_base_id=campaign["knowledge_base_id"],
            knowledge_base_name=campaign["knowledge_base_name"],
            welcome_message=campaign["welcome_message"],
            language=campaign["language"],
            chunk_size=campaign["chunk_size"],
            retry_failed=campaign["retry_failed"],
            user_id=campaign.get("user_id")
        )
        
        # Start processing retry campaign
        asyncio.create_task(process_campaign(retry_campaign["_id"]))
        
        return JSONResponse({
            "status": "success",
            "retry_campaign_id": retry_campaign["_id"],
            "numbers_to_retry": len(failed_numbers),
            "message": "Retry campaign created and processing started"
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/campaigns/{campaign_id}/download")
async def download_campaign_data(
    campaign_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Download campaign data as CSV"""
    import io
    
    try:
        campaign_db = get_campaign_db()
        call_history_db = get_call_history_db()
        
        campaign = await campaign_db.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Check authorization
        if not is_admin(current_user) and campaign.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to download this campaign")
        
        # Get all call details
        call_details = await call_history_db.get_calls_by_campaign(campaign_id)
        
        # Build CSV content
        csv_lines = []
        csv_lines.append("Phone Number,Call SID,Status,Duration (seconds),Lead Status,Created At,Summary,Transcript")
        
        for call in call_details:
            phone = call.get("phone_number", "")
            call_sid = call.get("call_sid", "")
            status = call.get("status", "")
            duration = call.get("duration", 0)
            lead_status = call.get("lead_status", "").upper() if call.get("lead_status") else ""
            created_at = call.get("created_at", "")
            summary = call.get("summary", "").replace('"', '""')  # Escape quotes
            
            # Format transcript as readable conversation
            transcript = call.get("transcript", [])
            if transcript:
                transcript_text = " | ".join([
                    f"{msg.get('role', '').upper()}: {msg.get('content', '')}" 
                    for msg in transcript
                ])
                transcript_text = transcript_text.replace('"', '""')  # Escape quotes
            else:
                transcript_text = ""
            
            csv_lines.append(f'"{phone}","{call_sid}","{status}",{duration},"{lead_status}","{created_at}","{summary}","{transcript_text}"')
        
        csv_content = "\n".join(csv_lines)
        
        # Return as downloadable CSV
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=campaign_{campaign['name'].replace(' ', '_')}.csv"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a campaign"""
    try:
        campaign_db = get_campaign_db()
        
        # Check campaign exists and authorization
        campaign = await campaign_db.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        if not is_admin(current_user) and campaign.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this campaign")
        
        success = await campaign_db.delete_campaign(campaign_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return JSONResponse({
            "status": "success",
            "message": "Campaign deleted successfully"
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def process_campaign(campaign_id: str):
    """Process campaign calls in chunks with retry logic"""
    try:
        campaign_db = get_campaign_db()
        call_history_db = get_call_history_db()
        
        campaign = await campaign_db.get_campaign(campaign_id)
        if not campaign:
            print(f"✗ Campaign {campaign_id} not found")
            return
        
        # Update campaign status to processing
        await campaign_db.update_campaign(
            campaign_id,
            {
                "status": "processing",
                "started_at": datetime.utcnow()
            }
        )
        
        phone_numbers = campaign["phone_numbers"]
        chunk_size = campaign["chunk_size"]
        kb_id = campaign["knowledge_base_id"]
        kb_name = campaign["knowledge_base_name"]
        welcome_message = campaign["welcome_message"]
        language = campaign["language"]
        tts_engine = campaign.get("tts_engine", "cartesia")
        tts_voice = campaign.get("tts_voice", "")

        print(f"✓ Processing campaign: {campaign['name']} ({len(phone_numbers)} numbers, tts={tts_engine})")
        
        # Process numbers in chunks
        for i in range(0, len(phone_numbers), chunk_size):
            chunk = phone_numbers[i:i + chunk_size]
            print(f"Processing chunk {i//chunk_size + 1}: {len(chunk)} calls")
            
            # Process calls in parallel within chunk
            tasks = []
            for phone_number in chunk:
                task = make_single_call(
                    phone_number=phone_number,
                    kb_id=kb_id,
                    kb_name=kb_name,
                    welcome_message=welcome_message,
                    language=language,
                    campaign_id=campaign_id,
                    campaign_db=campaign_db,
                    call_history_db=call_history_db,
                    tts_engine=tts_engine,
                    tts_voice=tts_voice
                )
                tasks.append(task)
            
            # Wait for all calls in chunk to complete
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Small delay between chunks to avoid overwhelming the system
            await asyncio.sleep(2)
        
        # Update campaign status to completed
        await campaign_db.update_campaign(
            campaign_id,
            {
                "status": "completed",
                "completed_at": datetime.utcnow()
            }
        )
        
        print(f"✓ Campaign completed: {campaign['name']}")
    
    except Exception as e:
        print(f"✗ Error processing campaign {campaign_id}: {e}")
        traceback.print_exc()
        
        # Update campaign status to failed
        try:
            await campaign_db.update_campaign(
                campaign_id,
                {
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": datetime.utcnow()
                }
            )
        except:
            pass


async def make_single_call(
    phone_number: str,
    kb_id: str,
    kb_name: str,
    welcome_message: str,
    language: str,
    campaign_id: str,
    campaign_db: CampaignDB,
    call_history_db: CallHistoryDB,
    tts_engine: str = "cartesia",
    tts_voice: str = ""
):
    """Make a single call as part of a campaign"""
    try:
        # Get campaign to get user_id
        campaign = await campaign_db.get_campaign(campaign_id)
        user_id = campaign.get("user_id") if campaign else None
        
        # Update campaign progress (in_progress +1)
        await campaign_db.update_campaign_progress(campaign_id, in_progress=1)
        
        # Create TwiML
        twiml = VoiceResponse()
        
        if language == 'en':
            twiml.say(welcome_message, voice="Polly.Joanna")
        elif language == 'hi':
            twiml.say(welcome_message, language="hi-IN")
        
        twiml.pause(length=1)
        
        connect = Connect()
        websocket_url = f'{SERVER_URL.replace("https://", "wss://").replace("http://", "ws://")}/ws/media-stream'
        stream = Stream(url=websocket_url)
        
        # Add custom parameters
        stream.parameter(name='kb_id', value=kb_id)
        stream.parameter(name='language', value=language)
        stream.parameter(name='tts_engine', value=tts_engine)
        stream.parameter(name='tts_voice', value=tts_voice)
        stream.parameter(name='campaign_id', value=campaign_id)
        
        connect.append(stream)
        twiml.append(connect)
        twiml.pause(length=3600)
        
        # Make the call
        call = twilio_client.calls.create(
            to=phone_number,
            from_=TWILIO_PHONE_NUMBER,
            twiml=str(twiml)
        )
        
        # Create call history record
        await call_history_db.create_call(
            call_sid=call.sid,
            phone_number=phone_number,
            knowledge_base_id=kb_id,
            knowledge_base_name=kb_name,
            status="initiated",
            campaign_id=campaign_id,
            user_id=user_id
        )
        
        # Add call result to campaign
        await campaign_db.add_call_result(
            campaign_id=campaign_id,
            phone_number=phone_number,
            call_sid=call.sid,
            status="success"
        )
        
        # Update campaign progress (in_progress -1, completed +1, successful +1)
        await campaign_db.update_campaign_progress(
            campaign_id,
            completed=1,
            successful=1,
            in_progress=-1
        )
        
        print(f"✓ Call initiated: {phone_number} -> {call.sid}")
    
    except Exception as e:
        print(f"✗ Failed to call {phone_number}: {e}")
        
        # Add failed call result to campaign
        await campaign_db.add_call_result(
            campaign_id=campaign_id,
            phone_number=phone_number,
            call_sid="",
            status="failed",
            error=str(e)
        )
        
        # Update campaign progress (in_progress -1, completed +1, failed +1)
        await campaign_db.update_campaign_progress(
            campaign_id,
            completed=1,
            failed=1,
            in_progress=-1
        )


# ============================================================================
# END CAMPAIGN MANAGEMENT
# ============================================================================


# @app.post("/voice/outbound")
# async def make_outbound_call_legacy(request: dict):
#     """Legacy endpoint - Initiate outbound call"""
#     to_number = request.get("to_number")
#     kb_id = request.get("kb_id", "Akashvanni")
#     server_url = request.get('server_url', "https://kathlyn-clamatorial-manda.ngrok-free.dev")
    
#     if not to_number:
#         return {"error": "to_number is required"}
    
#     server_url = server_url.rstrip('/')
    
#     twiml = VoiceResponse()
#     twiml.say("Hello! This is आरती from Akashvanni calling you.", voice="Polly.Joanna")
#     twiml.pause(length=1)
    
#     connect = Connect()
#     websocket_url = f'wss://kathlyn-clamatorial-manda.ngrok-free.dev/ws/media-stream?kb_id={kb_id}'
#     stream = Stream(url=websocket_url)
#     connect.append(stream)
#     twiml.append(connect)
    
#     twiml.pause(length=3600)
    
#     try:
#         call = twilio_client.calls.create(
#             to=to_number,
#             from_=TWILIO_PHONE_NUMBER,
#             twiml=str(twiml)
#         )
        
#         return {
#             "status": "call_initiated",
#             "call_sid": call.sid,
#             "to": to_number,
#             "websocket_url": websocket_url
#         }
#     except Exception as e:
#         return {"error": str(e)}

@app.websocket("/ws/media-stream")
async def media_stream_handler(websocket: WebSocket):
    """Handle Twilio Media Stream WebSocket connection with REAL-TIME Deepgram STT"""
    await websocket.accept()
    print("[WS] ✓ WebSocket CONNECTED - Twilio media stream accepted")
    print(f"[WS] Client: {websocket.client}")

    # Default values - will be updated from start event
    kb_id = "Akashvanni"
    language = "en"
    voice_id = None
    deepgram_language = "en"
    
    # Session state
    conversation_history = []
    stream_sid = None
    call_sid = None
    call_start_time = time.time()
    
    # MongoDB call history database
    call_history_db = get_call_history_db()
    call_record = None
    
    # Deepgram streaming connection state
    deepgram_connection = None
    transcript_buffer = []
    is_processing = False
    is_speaking = False
    stt_start_time = None
    
    # Get the current event loop for scheduling tasks from threads
    event_loop = asyncio.get_event_loop()
    
    # Per-call connections (created after start event)
    cartesia_ws = None
    sarvam_client = None
    tts_engine = "cartesia"
    call_identifier = None
    
    try:
        msg_count = 0
        async for message in websocket.iter_text():
            data = json.loads(message)
            event_type = data.get("event")
            msg_count += 1

            if msg_count <= 5 or msg_count % 100 == 0:
                print(f"[WS] Message #{msg_count}: event={event_type}")

            if event_type == "start":
                stream_sid = data["start"]["streamSid"]
                call_sid = data["start"]["callSid"]

                # Extract custom parameters from start event
                custom_params = data["start"].get("customParameters", {})
                kb_id = custom_params.get("kb_id", "Akashvanni")
                language = custom_params.get("language", "en")

                # Read TTS preferences from custom params (user's choice)
                tts_engine = custom_params.get("tts_engine", "cartesia")
                tts_voice = custom_params.get("tts_voice", "")

                print(f"[WS] ✓ Stream STARTED: streamSid={stream_sid}, callSid={call_sid}")
                print(f"[WS] ✓ Custom params: kb_id={kb_id}, language={language}, tts_engine={tts_engine}, tts_voice={tts_voice}")

                # Get language configuration
                lang_config = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["en"])
                voice_id = lang_config["voice_id"]
                deepgram_language = lang_config["deepgram_language"]

                # Override voice_id if user selected a Cartesia voice
                if tts_engine == "cartesia" and tts_voice:
                    voice_id = tts_voice

                # Override Sarvam speaker if user selected one
                sarvam_speaker = tts_voice if (tts_engine == "sarvam" and tts_voice) else SARVAM_HINDI_SPEAKER

                # Validate Sarvam availability
                if tts_engine == "sarvam" and not SARVAM_API_KEY:
                    print("✗ Sarvam requested but no API key, falling back to Cartesia")
                    tts_engine = "cartesia"

                print(f"[WS] ✓ TTS engine: {tts_engine}, voice: {tts_voice or 'default'}")

                # Pre-initialize KB
                try:
                    initialize_kb(kb_id)
                    print(f"✓ KB initialized: {kb_id}")
                except Exception as e:
                    print(f"Warning: KB init failed: {e}")

                # Create unique identifier for this call
                call_identifier = f"call_{call_sid}_{int(time.time() * 1000)}"

                # Create TTS connection based on engine
                if tts_engine == "sarvam":
                    sarvam_client = await connection_manager.create_sarvam_client(call_identifier)
                    if not sarvam_client:
                        print("✗ Sarvam failed, falling back to Cartesia")
                        tts_engine = "cartesia"

                if tts_engine == "cartesia":
                    cartesia_ws = await connection_manager.create_cartesia_connection(call_identifier)
                    if not cartesia_ws:
                        print("✗ Failed to create Cartesia connection")
                        await websocket.close()
                        return
                
                # Initialize Deepgram with correct language
                deepgram_connection = connection_manager.create_deepgram_connection(call_identifier, deepgram_language)
                
                if deepgram_connection:
                    def on_open(_):
                        print(f"✓ Deepgram connection opened for language: {deepgram_language}")
                    
                    def on_message(result):
                        nonlocal transcript_buffer, is_processing, stt_start_time
                        
                        if hasattr(result, 'channel'):
                            if isinstance(result.channel, list) and len(result.channel) > 0:
                                channel = result.channel[0]
                            else:
                                channel = result.channel
                            
                            if hasattr(channel, 'alternatives') and len(channel.alternatives) > 0:
                                sentence = channel.alternatives[0].transcript
                            else:
                                return
                            
                            if len(sentence) == 0:
                                return
                            
                            if result.is_final:
                                if stt_start_time is None:
                                    stt_start_time = time.time()
                                print(f"🎤 [FINAL]: {sentence}")
                                transcript_buffer.append(sentence)
                                
                                if result.speech_final:
                                    if stt_start_time is not None:
                                        stt_time = time.time() - stt_start_time
                                        print(f"⏱️ STT: {stt_time:.2f}s")
                                        stt_start_time = None
                                    
                                    full_transcript = " ".join(transcript_buffer).strip()
                                    transcript_buffer.clear()
                                    
                                    if full_transcript and not is_processing:
                                        print(f"👤 Complete utterance: {full_transcript}")
                                        is_processing = True
                                        asyncio.run_coroutine_threadsafe(
                                            process_transcript(
                                                websocket,
                                                full_transcript,
                                                conversation_history,
                                                kb_id,
                                                stream_sid,
                                                cartesia_ws,
                                                language,
                                                voice_id,
                                                tts_engine=tts_engine,
                                                sarvam_client=sarvam_client,
                                                sarvam_speaker=sarvam_speaker
                                            ),
                                            event_loop
                                        )
                            else:
                                print(f"🎤 [INTERIM]: {sentence}")
                    
                    def on_error(error):
                        print(f"✗ Deepgram error: {error}")
                    
                    def on_close(close_msg):
                        print("✓ Deepgram connection closed")
                    
                    deepgram_connection.on(LiveTranscriptionEvents.OPEN, on_open)
                    deepgram_connection.on(LiveTranscriptionEvents.MESSAGE, on_message)
                    deepgram_connection.on(LiveTranscriptionEvents.ERROR, on_error)
                    deepgram_connection.on(LiveTranscriptionEvents.CLOSE, on_close)
                    
                    def start_deepgram():
                        deepgram_connection.start_listening()
                    
                    deepgram_thread = threading.Thread(target=start_deepgram, daemon=True)
                    deepgram_thread.start()
                    print(f"✓ Deepgram connection established for language: {deepgram_language}")
                else:
                    print("✗ Failed to create Deepgram connection")
                
                # Update or create call record in MongoDB
                if call_sid:
                    call_record = await call_history_db.get_call_by_sid(call_sid)
                    
                    if call_record:
                        await call_history_db.update_call(
                            call_sid,
                            {"status": "in_progress"}
                        )
            
            elif event_type == "media":
                if msg_count == 6:
                    print(f"[WS] ✓ First MEDIA packet received - audio is flowing from Twilio")
                if deepgram_connection and not is_speaking:
                    try:
                        payload = data["media"]["payload"]
                        audio_chunk = base64.b64decode(payload)
                        deepgram_connection.send_media(audio_chunk)
                    except Exception as e:
                        print(f"[WS] ✗ Error sending to Deepgram: {e}")
                elif not deepgram_connection:
                    if msg_count < 10:
                        print(f"[WS] ✗ Media received but NO Deepgram connection!")
            
            elif event_type == "mark":
                mark_name = data.get("mark", {}).get("name", "")
                if mark_name.startswith("response_end"):
                    is_speaking = False
                    is_processing = False
                    print("✓ Ready for next input")
            
            elif event_type == "stop":
                print(f"[WS] Stream STOPPED after {msg_count} messages")
                break

            elif event_type == "connected":
                print(f"[WS] ✓ Twilio 'connected' event received")

    except WebSocketDisconnect:
        print(f"[WS] ✗ DISCONNECTED after {msg_count} messages, duration={time.time()-call_start_time:.1f}s")
    except Exception as e:
        print(f"[WS] ✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Save final call data to MongoDB
        if call_record and call_sid:
            try:
                call_duration = (time.time() - call_start_time) + 6 # Add 6 seconds to account for processing time after last media packet
                
                # Generate summary using LLM
                summary = None
                lead_status = None
                if conversation_history:
                    summary = await generate_call_summary(conversation_history)
                    # Analyze lead status based on conversation
                    lead_status = await analyze_lead_status(conversation_history, summary)
                
                # Calculate call cost and deduct from wallet
                wallet_db = get_wallet_db()
                transaction_db = get_transaction_db()
                
                call_cost = await wallet_db.calculate_call_cost(call_duration)
                user_id = call_record.get("user_id")
                
                if user_id and call_cost > 0:
                    try:
                        new_balance = await wallet_db.deduct_funds(
                            user_id=user_id,
                            amount=call_cost,
                            transaction_id=call_sid
                        )
                        
                        # Create debit transaction
                        await transaction_db.create_transaction(
                            user_id=user_id,
                            transaction_type="debit",
                            amount=call_cost,
                            description=f"Call charges ({call_duration:.1f}s)",
                            call_sid=call_sid,
                            campaign_id=call_record.get("campaign_id"),
                            metadata={
                                "duration_seconds": call_duration,
                                "lead_status": lead_status
                            }
                        )
                        
                        print(f"✓ Debited Rs. {call_cost:.2f} from wallet. New balance: Rs. {new_balance:.2f}")
                    except ValueError as e:
                        print(f"⚠️ Could not debit wallet: {e}")
                    except Exception as e:
                        print(f"✗ Error debiting wallet: {e}")
                
                # Update call record
                await call_history_db.update_call(
                    call_sid,
                    {
                        "ended_at": datetime.utcnow(),
                        "duration": call_duration,
                        "status": "completed",
                        "transcript": conversation_history,
                        "summary": summary,
                        "lead_status": lead_status,
                        "call_cost": call_cost
                    }
                )
                print(f"✓ Call record saved (duration: {call_duration:.1f}s, cost: Rs. {call_cost:.2f}, lead: {lead_status})")
                
                # Update campaign progress with lead status if this is a campaign call
                if call_record.get("campaign_id") and lead_status:
                    from campaigns import get_campaign_db
                    campaign_db = get_campaign_db()
                    if lead_status == "hot":
                        await campaign_db.update_campaign_progress(
                            call_record["campaign_id"],
                            hot_leads=1
                        )
                    else:
                        await campaign_db.update_campaign_progress(
                            call_record["campaign_id"],
                            cold_leads=1
                        )
            except Exception as e:
                print(f"✗ Error saving call record: {e}")
        
        # Cleanup Deepgram connection for this call
        if call_identifier:
            connection_manager.cleanup_deepgram(call_identifier)
            await connection_manager.cleanup_cartesia(call_identifier)
            await connection_manager.cleanup_sarvam(call_identifier)
        
        try:
            await websocket.close()
        except:
            pass


async def analyze_lead_status(conversation_history, summary):
    """Analyze conversation to determine if lead is hot or cold"""
    try:
        # Create transcript text
        transcript_text = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}" 
            for msg in conversation_history
        ])
        
        response = await asyncio.to_thread(
            groq_client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": """Analyze this phone conversation and determine if the lead is HOT or COLD.
                    
                    HOT lead indicators:
                    - User shows interest in the service/product
                    - User asks for more information or details
                    - User agrees to follow-up or next steps
                    - User expresses positive sentiment
                    - User asks questions about pricing, features, or implementation
                    - User schedules a meeting or callback
                    
                    COLD lead indicators:
                    - User explicitly says not interested
                    - User hangs up quickly or doesn't engage
                    - User asks to be removed from list
                    - User shows negative sentiment or frustration
                    - Minimal conversation or engagement
                    
                    Respond with ONLY 'hot' or 'cold' (lowercase)."""
                },
                {
                    "role": "user",
                    "content": f"Conversation:\n{transcript_text}\n\nSummary: {summary}"
                }
            ],
            temperature=0.1,
            max_tokens=10
        )
        
        lead_status = response.choices[0].message.content.strip().lower()
        # Ensure we only return 'hot' or 'cold'
        return "hot" if "hot" in lead_status else "cold"
    except Exception as e:
        print(f"Error analyzing lead status: {e}")
        return "cold"  # Default to cold if analysis fails


async def generate_call_summary(conversation_history):
    """Generate a brief summary of the call using LLM"""
    try:
        # Create summary prompt
        transcript_text = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}" 
            for msg in conversation_history
        ])
        
        response = await asyncio.to_thread(
            groq_client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "Summarize this phone conversation in 2-3 concise sentences. Focus on the main topics discussed and any outcomes."
                },
                {
                    "role": "user",
                    "content": transcript_text
                }
            ],
            temperature=0.3,
            max_tokens=150
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating summary: {e}")
        return "Summary generation failed"


async def process_transcript(websocket, transcript, conversation_history, kb_id, stream_sid, cartesia_ws, language="en", voice_id=None, tts_engine="cartesia", sarvam_client=None, sarvam_speaker=None):
    """Process transcript from Deepgram and generate response with TTS (Cartesia or Sarvam)"""
    
    # Use provided voice_id or get from language config
    if voice_id is None:
        voice_id = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["en"])["voice_id"]
    start_time = time.time()
    
    try:
        user_message = transcript.strip()
        
        # Filter noise patterns
        noise_patterns = ["thank you for watching", "thanks for watching", ".", "..", "..."]
        if user_message.lower().strip() in noise_patterns:
            print("✗ Noise pattern detected")
            return
        
        # Check for duplicate (echo prevention)
        # if len(conversation_history) >= 2:
        #     last_user = next((m["content"] for m in reversed(conversation_history) if m["role"] == "user"), None)
        #     if last_user:
        #         from difflib import SequenceMatcher
        #         similarity = SequenceMatcher(None, user_message.lower(), last_user.lower()).ratio()
        #         if similarity > 0.85:
        #             print(f"✗ Duplicate (similarity: {similarity:.2f})")
        #             return
        
        print(f"👤 User: {user_message}")
        
        # Clear any pending audio immediately
        await websocket.send_text(json.dumps({"event": "clear", "streamSid": stream_sid}))
        
        # RAG context retrieval
        rag_start = time.time()
        
        # Set system prompt based on language
        if language == "hi":
            base_prompt = """आप आरती हैं, आकाशवाणी (Akashwanni) की आधिकारिक Voice AI प्रतिनिधि।

आपके नियम:
- आप सिर्फ़ आकाशवाणी और उसकी Voice AI सेवाओं के बारे में बात करेंगी। किसी और विषय पर बात न करें।
- अगर कोई आकाशवाणी से असंबंधित सवाल पूछे, तो विनम्रता से कहें "मैं सिर्फ़ आकाशवाणी की सेवाओं के बारे में बात कर सकती हूँ। क्या मैं आपको हमारे Voice AI समाधान के बारे में बता सकती हूँ?"
- पूरे और स्पष्ट वाक्यों में जवाब दें। अधूरा जवाब कभी न दें।
- दो से तीन वाक्यों में जवाब दें — न बहुत छोटा, न बहुत लंबा।
- सहज, स्वाभाविक हिंदी में बोलें जैसे फ़ोन पर बात करते हैं।
- ग्राहक की ज़रूरत समझें और डेमो बुक करने की कोशिश करें।
- नीचे दिए गए संदर्भ (Context) का उपयोग करके जवाब दें।"""
        else:
            base_prompt = """You are Aarati, the official Voice AI Representative of Akashwanni.

Your rules:
- You ONLY talk about Akashwanni and its Voice AI services. Do NOT discuss any other topic.
- If someone asks about anything unrelated to Akashwanni, politely say "I can only help with Akashwanni's voice AI services. Would you like to know how we can help your business?"
- Give complete, well-formed responses. Never give half-finished answers.
- Keep responses to 2-3 sentences — not too short, not too long. Enough to be helpful and conversational.
- Sound warm, confident, and natural like a real person on a phone call.
- Understand the caller's business need and try to book a demo.
- Use the Context provided below to answer questions accurately."""
        
        if kb_id and kb_id != "general":
            context = await asyncio.to_thread(get_kb_context_fast, kb_id, user_message, 3)
            rag_time = time.time() - rag_start
            print(f"⏱️ RAG: {rag_time:.2f}s")
            system_prompt = f"{base_prompt}\n\nContext: {context}"
        else:
            system_prompt = base_prompt
        
        messages_base = conversation_history[-8:]
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(messages_base)
        messages.append({"role": "user", "content": user_message})
        
        # LLM with Groq streaming (ultra-fast inference)
        llm_start = time.time()
        stream = await asyncio.to_thread(
            groq_client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=200,
            stream=True
        )
        
        # Collect streaming response
        ai_response = ""
        for chunk in stream:
            if chunk.choices[0].delta.content:
                ai_response += chunk.choices[0].delta.content
        
        ai_response = ai_response.strip()
        llm_time = time.time() - llm_start
        print(f"⏱️ LLM (Groq Streaming): {llm_time:.2f}s")
        print(f"🤖 AI: {ai_response}")
        
        # Update history
        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": ai_response})
        
        # TTS - Route to Cartesia or Sarvam based on engine
        tts_start = time.time()
        chunks = 0

        if tts_engine == "sarvam" and sarvam_client:
            # Sarvam TTS (streaming) - optimized for Indian languages
            try:
                sarvam_lang = "hi-IN" if language == "hi" else "en-IN"
                async with sarvam_client.text_to_speech_streaming.connect(
                    model=SARVAM_MODEL,
                    send_completion_event="true"
                ) as sarvam_ws:
                    await sarvam_ws.configure(
                        target_language_code=sarvam_lang,
                        speaker=sarvam_speaker or SARVAM_HINDI_SPEAKER,
                        pace=1.0,
                        output_audio_codec="mulaw",
                        speech_sample_rate=8000,
                    )

                    await sarvam_ws.convert(ai_response)
                    await sarvam_ws.flush()

                    async for msg in sarvam_ws:
                        if isinstance(msg, AudioOutput):
                            audio_b64 = msg.data.audio
                            if audio_b64:
                                await websocket.send_text(json.dumps({
                                    "event": "media",
                                    "streamSid": stream_sid,
                                    "media": {"payload": audio_b64}
                                }))
                                chunks += 1
                        elif isinstance(msg, EventResponse):
                            if msg.data.event_type == "final":
                                break

                tts_time = time.time() - tts_start
                print(f"⏱️ TTS (Sarvam): {tts_time:.2f}s")
            except Exception as sarvam_err:
                print(f"✗ Sarvam TTS error: {sarvam_err}, falling back to Cartesia")
                tts_engine = "cartesia"

        if tts_engine == "cartesia":
            # Cartesia TTS (ULTRA-FAST streaming)
            context_id = f"ctx_{int(time.time() * 1000)}"

            request = {
                "model_id": "sonic-multilingual",
                "transcript": ai_response,
                "voice": {
                    "mode": "id",
                    "id": voice_id
                },
                "context_id": context_id,
                "output_format": {
                    "container": "raw",
                    "encoding": "pcm_mulaw",
                    "sample_rate": 8000
                },
                "continue": False
            }
            if language == "hi":
                request["language"] = "hi"

            await cartesia_ws.send(json.dumps(request))

            while True:
                try:
                    response = await asyncio.wait_for(cartesia_ws.recv(), timeout=2.0)
                    data = json.loads(response)

                    if data.get("type") == "chunk":
                        audio_b64 = data.get("data")
                        if audio_b64:
                            await websocket.send_text(json.dumps({
                                "event": "media",
                                "streamSid": stream_sid,
                                "media": {"payload": audio_b64}
                            }))
                            chunks += 1

                    elif data.get("type") == "done":
                        break

                except asyncio.TimeoutError:
                    break

            tts_time = time.time() - tts_start
            print(f"⏱️ TTS (Cartesia): {tts_time:.2f}s")
        
        # Mark completion
        await websocket.send_text(json.dumps({
            "event": "mark",
            "streamSid": stream_sid,
            "mark": {"name": f"response_end_{len(conversation_history)}"}
        }))
        
        total = time.time() - start_time
        print(f"⏱️ TOTAL: {total:.2f}s ({chunks} chunks)")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8800))
    uvicorn.run(app, host="0.0.0.0", port=port)
