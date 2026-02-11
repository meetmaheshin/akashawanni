# Transaction Management Module
from typing import Optional, List
from datetime import datetime
from bson import ObjectId


class TransactionDB:
    """Database operations for wallet transactions"""
    
    def __init__(self, db):
        self.collection = db["transactions"]
    
    async def initialize_indexes(self):
        """Create indexes for transaction collection"""
        await self.collection.create_index("user_id")
        await self.collection.create_index("created_at")
        await self.collection.create_index([("user_id", 1), ("created_at", -1)])
        await self.collection.create_index("transaction_type")
        await self.collection.create_index("payment_id")
        await self.collection.create_index("call_sid")
    
    async def create_transaction(
        self,
        user_id: str,
        transaction_type: str,  # "credit" or "debit"
        amount: float,
        description: str,
        payment_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        call_sid: Optional[str] = None,
        campaign_id: Optional[str] = None,
        metadata: Optional[dict] = None
    ):
        """Create a new transaction record"""
        transaction = {
            "user_id": user_id,
            "transaction_type": transaction_type,
            "amount": amount,
            "description": description,
            "payment_id": payment_id,
            "payment_method": payment_method,
            "call_sid": call_sid,
            "campaign_id": campaign_id,
            "metadata": metadata or {},
            "created_at": datetime.utcnow()
        }
        
        result = await self.collection.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)
        return transaction
    
    async def get_transactions(
        self,
        user_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[dict]:
        """Get transactions with filters"""
        query = {}
        
        if user_id:
            query["user_id"] = user_id
        
        if transaction_type:
            query["transaction_type"] = transaction_type
        
        cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        transactions = await cursor.to_list(length=limit)
        
        for txn in transactions:
            txn["_id"] = str(txn["_id"])
        
        return transactions
    
    async def get_total_count(
        self,
        user_id: Optional[str] = None,
        transaction_type: Optional[str] = None
    ) -> int:
        """Get total transaction count with filters"""
        query = {}
        
        if user_id:
            query["user_id"] = user_id
        
        if transaction_type:
            query["transaction_type"] = transaction_type
        
        return await self.collection.count_documents(query)
    
    async def get_transaction_by_payment_id(self, payment_id: str):
        """Get transaction by payment ID"""
        transaction = await self.collection.find_one({"payment_id": payment_id})
        if transaction:
            transaction["_id"] = str(transaction["_id"])
        return transaction
    
    async def get_user_balance_summary(self, user_id: str):
        """Get user's transaction summary (total credits, debits)"""
        pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": "$transaction_type",
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=10)
        
        summary = {
            "total_credits": 0.0,
            "total_debits": 0.0,
            "credit_count": 0,
            "debit_count": 0
        }
        
        for item in result:
            if item["_id"] == "credit":
                summary["total_credits"] = round(item["total"], 2)
                summary["credit_count"] = item["count"]
            elif item["_id"] == "debit":
                summary["total_debits"] = round(item["total"], 2)
                summary["debit_count"] = item["count"]
        
        return summary


# Global transaction database instance
_transaction_db = None


def get_transaction_db() -> TransactionDB:
    """Get transaction database instance"""
    global _transaction_db
    if _transaction_db is None:
        from database import get_database
        db = get_database()
        _transaction_db = TransactionDB(db)
    return _transaction_db


async def initialize_transaction_db():
    """Initialize transaction database indexes"""
    transaction_db = get_transaction_db()
    await transaction_db.initialize_indexes()
