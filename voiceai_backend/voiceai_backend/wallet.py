# Wallet Management Module
from typing import Optional
from datetime import datetime
from bson import ObjectId


class WalletDB:
    """Database operations for user wallets"""
    
    def __init__(self, db):
        self.collection = db["wallets"]
        self.settings_collection = db["wallet_settings"]
    
    async def initialize_indexes(self):
        """Create indexes for wallet collection"""
        await self.collection.create_index("user_id", unique=True)
        await self.collection.create_index("created_at")
    
    async def create_wallet(self, user_id: str, initial_balance: float = 0.0):
        """Create a new wallet for a user"""
        wallet = {
            "user_id": user_id,
            "balance": initial_balance,
            "currency": "INR",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await self.collection.insert_one(wallet)
        wallet["_id"] = str(result.inserted_id)
        return wallet
    
    async def get_wallet_by_user_id(self, user_id: str):
        """Get wallet by user ID"""
        wallet = await self.collection.find_one({"user_id": user_id})
        if wallet:
            wallet["_id"] = str(wallet["_id"])
        return wallet
    
    async def get_balance(self, user_id: str) -> float:
        """Get current wallet balance for a user"""
        wallet = await self.get_wallet_by_user_id(user_id)
        return wallet["balance"] if wallet else 0.0
    
    async def add_funds(self, user_id: str, amount: float, transaction_id: str = None):
        """Add funds to wallet (credit)"""
        if amount <= 0:
            raise ValueError("Amount must be positive")
        
        result = await self.collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"balance": amount},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            # Wallet doesn't exist, create it
            await self.create_wallet(user_id, amount)
        
        # Get updated balance
        wallet = await self.get_wallet_by_user_id(user_id)
        return wallet["balance"]
    
    async def deduct_funds(self, user_id: str, amount: float, transaction_id: str = None):
        """Deduct funds from wallet (debit)"""
        if amount <= 0:
            raise ValueError("Amount must be positive")
        
        # Check if sufficient balance
        wallet = await self.get_wallet_by_user_id(user_id)
        if not wallet or wallet["balance"] < amount:
            raise ValueError("Insufficient balance")
        
        result = await self.collection.update_one(
            {"user_id": user_id, "balance": {"$gte": amount}},
            {
                "$inc": {"balance": -amount},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            raise ValueError("Insufficient balance or wallet not found")
        
        # Get updated balance
        wallet = await self.get_wallet_by_user_id(user_id)
        return wallet["balance"]
    
    async def has_minimum_balance(self, user_id: str, minimum: float = 10.0) -> bool:
        """Check if user has minimum required balance"""
        balance = await self.get_balance(user_id)
        return balance >= minimum
    
    async def get_call_rate_per_minute(self) -> float:
        """Get configurable call rate per minute"""
        settings = await self.settings_collection.find_one({"key": "call_rate_per_minute"})
        if settings:
            return float(settings["value"])
        
        # Default rate: Rs. 10 per minute
        await self.settings_collection.update_one(
            {"key": "call_rate_per_minute"},
            {"$set": {"value": 10.0, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return 10.0
    
    async def set_call_rate_per_minute(self, rate: float):
        """Set call rate per minute (admin only)"""
        await self.settings_collection.update_one(
            {"key": "call_rate_per_minute"},
            {"$set": {"value": rate, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    
    async def calculate_call_cost(self, duration_seconds: float) -> float:
        """Calculate cost for a call based on duration"""
        rate_per_minute = await self.get_call_rate_per_minute()
        duration_minutes = duration_seconds / 60.0
        cost = duration_minutes * rate_per_minute
        return round(cost, 2)


# Global wallet database instance
_wallet_db = None


def get_wallet_db() -> WalletDB:
    """Get wallet database instance"""
    global _wallet_db
    if _wallet_db is None:
        from database import get_database
        db = get_database()
        _wallet_db = WalletDB(db)
    return _wallet_db


async def initialize_wallet_db():
    """Initialize wallet database indexes"""
    wallet_db = get_wallet_db()
    await wallet_db.initialize_indexes()
