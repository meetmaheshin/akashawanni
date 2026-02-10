"""Database operations for VoiceAI call history using MongoDB"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from datetime import datetime
from typing import Optional, List, Dict, Any
import os
import certifi
from bson import ObjectId
from dotenv import load_dotenv
load_dotenv()

# MongoDB Configuration
MONGODB_URL = os.getenv("MONGODB_URL")#, "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("MONGODB_DATABASE", "voiceai")
print("MONGODB_URL:::::::::::::::", MONGODB_URL)

# Global MongoDB client and database
mongodb_client: Optional[AsyncIOMotorClient] = None
mongodb_database = None


class CallHistoryDB:
    """MongoDB operations for call history"""
    
    def __init__(self):
        self.collection_name = "call_history"
    
    @property
    def collection(self):
        """Get the call_history collection"""
        if mongodb_database is None:
            raise RuntimeError("Database not initialized")
        return mongodb_database[self.collection_name]
    
    async def create_call(
        self,
        call_sid: str,
        phone_number: str,
        knowledge_base_id: str,
        knowledge_base_name: str = None,
        status: str = "initiated",
        campaign_id: str = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Create a new call history record"""
        call_data = {
            "call_sid": call_sid,
            "phone_number": phone_number,
            "knowledge_base_id": knowledge_base_id,
            "knowledge_base_name": knowledge_base_name or knowledge_base_id,
            "status": status,
            "campaign_id": campaign_id,
            "user_id": user_id,
            "started_at": datetime.utcnow(),
            "ended_at": None,
            "duration": None,
            "transcript": [],
            "summary": None,
            "lead_status": None,
            "error": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await self.collection.insert_one(call_data)
        call_data["_id"] = str(result.inserted_id)
        return call_data
    
    async def get_call_by_sid(self, call_sid: str) -> Optional[Dict[str, Any]]:
        """Get call by Twilio call SID"""
        call = await self.collection.find_one({"call_sid": call_sid})
        if call:
            call["_id"] = str(call["_id"])
            # Convert datetime objects to ISO format strings
            if call.get("started_at"):
                call["started_at"] = call["started_at"].isoformat()
            if call.get("ended_at"):
                call["ended_at"] = call["ended_at"].isoformat()
            if call.get("created_at"):
                call["created_at"] = call["created_at"].isoformat()
            if call.get("updated_at"):
                call["updated_at"] = call["updated_at"].isoformat()
        return call
    
    async def update_call(self, call_sid: str, update_data: Dict[str, Any]) -> bool:
        """Update call record"""
        update_data["updated_at"] = datetime.utcnow()
        result = await self.collection.update_one(
            {"call_sid": call_sid},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def get_call_history(
        self,
        limit: int = 50,
        skip: int = 0,
        phone_number: Optional[str] = None,
        status: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get paginated call history"""
        query = {}
        if phone_number:
            query["phone_number"] = phone_number
        if status:
            query["status"] = status
        if user_id:
            query["user_id"] = user_id
        
        cursor = self.collection.find(query).sort("started_at", DESCENDING).skip(skip).limit(limit)
        calls = await cursor.to_list(length=limit)
        
        # Convert ObjectId and datetime objects to strings
        for call in calls:
            call["_id"] = str(call["_id"])
            if call.get("started_at"):
                call["started_at"] = call["started_at"].isoformat()
            if call.get("ended_at"):
                call["ended_at"] = call["ended_at"].isoformat()
            if call.get("created_at"):
                call["created_at"] = call["created_at"].isoformat()
            if call.get("updated_at"):
                call["updated_at"] = call["updated_at"].isoformat()
        
        return calls
    
    async def get_total_count(
        self,
        phone_number: Optional[str] = None,
        status: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> int:
        """Get total count of calls"""
        query = {}
        if phone_number:
            query["phone_number"] = phone_number
        if status:
            query["status"] = status
        if user_id:
            query["user_id"] = user_id
        
        return await self.collection.count_documents(query)
    
    async def delete_call(self, call_sid: str) -> bool:
        """Delete a call record"""
        result = await self.collection.delete_one({"call_sid": call_sid})
        return result.deleted_count > 0
    
    async def get_calls_by_campaign(self, campaign_id: str) -> List[Dict[str, Any]]:
        """Get all calls for a specific campaign with full details"""
        cursor = self.collection.find({"campaign_id": campaign_id}).sort("started_at", ASCENDING)
        calls = await cursor.to_list(length=None)
        
        # Convert ObjectId and datetime objects to strings
        for call in calls:
            call["_id"] = str(call["_id"])
            if call.get("started_at"):
                call["started_at"] = call["started_at"].isoformat()
            if call.get("ended_at"):
                call["ended_at"] = call["ended_at"].isoformat()
            if call.get("created_at"):
                call["created_at"] = call["created_at"].isoformat()
            if call.get("updated_at"):
                call["updated_at"] = call["updated_at"].isoformat()
        
        return calls


async def connect_to_mongodb():
    """Connect to MongoDB"""
    global mongodb_client, mongodb_database
    
    try:
        mongodb_client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
        mongodb_database = mongodb_client[DATABASE_NAME]
        
        # Create indexes for call_history collection
        call_history_collection = mongodb_database["call_history"]
        await call_history_collection.create_index([("call_sid", ASCENDING)], unique=True)
        await call_history_collection.create_index([("phone_number", ASCENDING)])
        await call_history_collection.create_index([("knowledge_base_id", ASCENDING)])
        await call_history_collection.create_index([("status", ASCENDING)])
        await call_history_collection.create_index([("started_at", DESCENDING)])
        await call_history_collection.create_index([("campaign_id", ASCENDING)])
        await call_history_collection.create_index([("user_id", ASCENDING)])
        
        # Create indexes for campaigns collection
        campaigns_collection = mongodb_database["campaigns"]
        await campaigns_collection.create_index([("status", ASCENDING)])
        await campaigns_collection.create_index([("created_at", DESCENDING)])
        await campaigns_collection.create_index([("knowledge_base_id", ASCENDING)])
        await campaigns_collection.create_index([("user_id", ASCENDING)])
        
        # Initialize campaign database
        from campaigns import initialize_campaign_db
        initialize_campaign_db(mongodb_database)
        
        # Test connection
        await mongodb_client.admin.command('ping')
        print("✓ MongoDB connected successfully")
        
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        raise


async def close_mongodb_connection():
    """Close MongoDB connection"""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
        print("✓ MongoDB connection closed")


def get_call_history_db() -> CallHistoryDB:
    """Get CallHistoryDB instance"""
    return CallHistoryDB()


def get_database():
    """Get the MongoDB database instance"""
    return mongodb_database
