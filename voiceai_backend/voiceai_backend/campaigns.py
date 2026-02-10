# Campaign Management Database Layer
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
import os

class CampaignDB:
    """Database operations for campaign management"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.campaigns = db.campaigns
        
    async def create_campaign(
        self,
        name: str,
        phone_numbers: List[str],
        knowledge_base_id: str,
        knowledge_base_name: str,
        welcome_message: str,
        language: str = "en",
        chunk_size: int = 10,
        retry_failed: bool = True,
        user_id: str = None
    ) -> Dict:
        """Create a new calling campaign"""
        
        campaign = {
            "name": name,
            "phone_numbers": phone_numbers,
            "total_numbers": len(phone_numbers),
            "knowledge_base_id": knowledge_base_id,
            "knowledge_base_name": knowledge_base_name,
            "welcome_message": welcome_message,
            "language": language,
            "chunk_size": chunk_size,
            "retry_failed": retry_failed,
            "user_id": user_id,
            "status": "pending",  # pending, processing, completed, failed, paused
            "progress": {
                "total": len(phone_numbers),
                "completed": 0,
                "successful": 0,
                "failed": 0,
                "in_progress": 0,
                "hot_leads": 0,
                "cold_leads": 0
            },
            "call_results": [],  # List of call_sid and status
            "created_at": datetime.utcnow(),
            "started_at": None,
            "completed_at": None,
            "error_message": None
        }
        
        result = await self.campaigns.insert_one(campaign)
        campaign["_id"] = str(result.inserted_id)
        
        return campaign
    
    async def get_campaign(self, campaign_id: str) -> Optional[Dict]:
        """Get campaign by ID"""
        try:
            campaign = await self.campaigns.find_one({"_id": ObjectId(campaign_id)})
            if campaign:
                campaign["_id"] = str(campaign["_id"])
                # Convert datetime objects to ISO format strings
                if campaign.get("created_at"):
                    campaign["created_at"] = campaign["created_at"].isoformat()
                if campaign.get("started_at"):
                    campaign["started_at"] = campaign["started_at"].isoformat()
                if campaign.get("completed_at"):
                    campaign["completed_at"] = campaign["completed_at"].isoformat()
                # Convert timestamps in call_results
                for result in campaign.get("call_results", []):
                    if result.get("timestamp"):
                        result["timestamp"] = result["timestamp"].isoformat()
            return campaign
        except:
            return None
    
    async def get_all_campaigns(self, limit: int = 50, skip: int = 0, user_id: str = None) -> List[Dict]:
        """Get all campaigns with pagination"""
        query = {}
        if user_id:
            query["user_id"] = user_id
        
        cursor = self.campaigns.find(query).sort("created_at", -1).skip(skip).limit(limit)
        campaigns = await cursor.to_list(length=limit)
        
        for campaign in campaigns:
            campaign["_id"] = str(campaign["_id"])
            # Convert datetime objects to ISO format strings
            if campaign.get("created_at"):
                campaign["created_at"] = campaign["created_at"].isoformat()
            if campaign.get("started_at"):
                campaign["started_at"] = campaign["started_at"].isoformat()
            if campaign.get("completed_at"):
                campaign["completed_at"] = campaign["completed_at"].isoformat()
            # Convert timestamps in call_results
            for result in campaign.get("call_results", []):
                if result.get("timestamp"):
                    result["timestamp"] = result["timestamp"].isoformat()
        
        return campaigns
    
    async def update_campaign(self, campaign_id: str, update_data: Dict) -> bool:
        """Update campaign data"""
        try:
            result = await self.campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except:
            return False
    
    async def update_campaign_progress(
        self,
        campaign_id: str,
        completed: int = 0,
        successful: int = 0,
        failed: int = 0,
        in_progress: int = 0,
        hot_leads: int = 0,
        cold_leads: int = 0
    ) -> bool:
        """Update campaign progress"""
        try:
            result = await self.campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {
                    "$inc": {
                        "progress.completed": completed,
                        "progress.successful": successful,
                        "progress.failed": failed,
                        "progress.in_progress": in_progress,
                        "progress.hot_leads": hot_leads,
                        "progress.cold_leads": cold_leads
                    }
                }
            )
            return result.modified_count > 0
        except:
            return False
    
    async def add_call_result(
        self,
        campaign_id: str,
        phone_number: str,
        call_sid: str,
        status: str,
        error: Optional[str] = None
    ) -> bool:
        """Add call result to campaign"""
        try:
            call_result = {
                "phone_number": phone_number,
                "call_sid": call_sid,
                "status": status,
                "timestamp": datetime.utcnow(),
                "error": error
            }
            
            result = await self.campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {"$push": {"call_results": call_result}}
            )
            return result.modified_count > 0
        except:
            return False
    
    async def get_failed_numbers(self, campaign_id: str) -> List[Dict]:
        """Get list of failed phone numbers from campaign"""
        try:
            campaign = await self.get_campaign(campaign_id)
            if not campaign:
                return []
            
            failed_calls = [
                result for result in campaign.get("call_results", [])
                if result["status"] == "failed"
            ]
            return failed_calls
        except:
            return []
    
    async def get_total_count(self, user_id: str = None) -> int:
        """Get total number of campaigns"""
        query = {}
        if user_id:
            query["user_id"] = user_id
        return await self.campaigns.count_documents(query)
    
    async def delete_campaign(self, campaign_id: str) -> bool:
        """Delete a campaign"""
        try:
            result = await self.campaigns.delete_one({"_id": ObjectId(campaign_id)})
            return result.deleted_count > 0
        except:
            return False


# Global campaign DB instance
_campaign_db: Optional[CampaignDB] = None

def get_campaign_db() -> CampaignDB:
    """Get global campaign database instance"""
    global _campaign_db
    if _campaign_db is None:
        raise RuntimeError("Campaign database not initialized")
    return _campaign_db

def initialize_campaign_db(db: AsyncIOMotorDatabase):
    """Initialize campaign database"""
    global _campaign_db
    _campaign_db = CampaignDB(db)
