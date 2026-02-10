# User Management Database Operations
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from typing import Optional
import os
import hashlib

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "voiceai"

client: Optional[AsyncIOMotorClient] = None
database = None

def get_password_hash(password: str) -> str:
    """Hash a password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against hash"""
    return get_password_hash(plain_password) == hashed_password


class UserDB:
    """User database operations"""
    
    def __init__(self, db):
        self.collection = db.users
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Create indexes for users collection"""
        # Email must be unique
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            loop.create_task(self.collection.create_index("email", unique=True))
        except:
            pass
    
    async def create_user(self, email: str, password: str, name: str, role: str = "user") -> dict:
        """Create a new user"""
        hashed_password = get_password_hash(password)
        
        user = {
            "email": email,
            "password": hashed_password,
            "name": name,
            "role": role,  # "user" or "admin"
            "created_at": datetime.utcnow(),
            "is_active": True
        }
        
        result = await self.collection.insert_one(user)
        user["_id"] = str(result.inserted_id)
        
        # Remove password from returned object
        user.pop("password")
        
        return user
    
    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email"""
        user = await self.collection.find_one({"email": email})
        
        if user:
            user["_id"] = str(user["_id"])
        
        return user
    
    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID"""
        from bson import ObjectId
        
        try:
            user = await self.collection.find_one({"_id": ObjectId(user_id)})
            
            if user:
                user["_id"] = str(user["_id"])
                user.pop("password", None)  # Don't return password
            
            return user
        except:
            return None
    
    async def authenticate_user(self, email: str, password: str) -> Optional[dict]:
        """Authenticate user with email and password"""
        user = await self.get_user_by_email(email)
        
        if not user:
            return None
        
        if not verify_password(password, user["password"]):
            return None
        
        if not user.get("is_active", True):
            return None
        
        # Remove password from returned object
        user.pop("password")
        
        return user
    
    async def update_user(self, user_id: str, update_data: dict) -> bool:
        """Update user information"""
        from bson import ObjectId
        
        try:
            # Don't allow updating password through this method
            update_data.pop("password", None)
            update_data["updated_at"] = datetime.utcnow()
            
            result = await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except:
            return False
    
    async def change_password(self, user_id: str, new_password: str) -> bool:
        """Change user password"""
        from bson import ObjectId
        
        try:
            hashed_password = get_password_hash(new_password)
            
            result = await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "password": hashed_password,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return result.modified_count > 0
        except:
            return False
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete a user (soft delete by setting is_active=False)"""
        from bson import ObjectId
        
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "is_active": False,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return result.modified_count > 0
        except:
            return False
    
    async def get_all_users(self, limit: int = 100, skip: int = 0) -> list:
        """Get all users (admin only)"""
        cursor = self.collection.find(
            {},
            {"password": 0}  # Don't return passwords
        ).skip(skip).limit(limit).sort("created_at", -1)
        
        users = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for user in users:
            user["_id"] = str(user["_id"])
        
        return users
    
    async def get_total_users_count(self) -> int:
        """Get total number of users"""
        return await self.collection.count_documents({})


# Global user database instance
user_db_instance: Optional[UserDB] = None


def get_user_db() -> UserDB:
    """Get user database instance"""
    return user_db_instance


async def initialize_user_db(db):
    """Initialize user database"""
    global user_db_instance
    user_db_instance = UserDB(db)


async def create_admin_user():
    """Create default admin user if not exists"""
    user_db = get_user_db()
    
    if not user_db:
        return
    
    # Check if admin exists
    admin = await user_db.get_user_by_email("admin@akashvanni.com")

    if not admin:
        try:
            await user_db.create_user(
                email="admin@akashvanni.com",
                password="akashvanniadmin",
                name="Admin",
                role="admin"
            )
            print("✓ Admin user created: admin@akashvanni.com")
        except Exception as e:
            print(f"Warning: Could not create admin user: {e}")
