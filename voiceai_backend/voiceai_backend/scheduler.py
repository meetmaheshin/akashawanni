# Campaign Scheduler - Background task to run scheduled campaigns
import asyncio
from datetime import datetime
from campaigns import get_campaign_db
from typing import Callable
import traceback


class CampaignScheduler:
    """Background scheduler to execute campaigns at scheduled times"""
    
    def __init__(self, check_interval: int = 60):
        """
        Initialize the campaign scheduler
        
        Args:
            check_interval: How often to check for scheduled campaigns (in seconds)
        """
        self.check_interval = check_interval
        self.is_running = False
        self._task = None
        self.process_campaign_callback: Callable = None
        
    def set_process_callback(self, callback: Callable):
        """Set the callback function to process campaigns"""
        self.process_campaign_callback = callback
    
    async def check_and_run_scheduled_campaigns(self):
        """Check for scheduled campaigns and run them"""
        try:
            campaign_db = get_campaign_db()
            scheduled_campaigns = await campaign_db.get_scheduled_campaigns_to_run()
            
            if scheduled_campaigns:
                print(f"✓ Found {len(scheduled_campaigns)} scheduled campaigns ready to run")
                
                for campaign in scheduled_campaigns:
                    try:
                        campaign_id = campaign["_id"]
                        campaign_name = campaign["name"]
                        
                        print(f"✓ Starting scheduled campaign: {campaign_name} (ID: {campaign_id})")
                        
                        # Update status to pending so it gets picked up by processor
                        await campaign_db.update_campaign(
                            campaign_id,
                            {"status": "pending"}
                        )
                        
                        # Trigger campaign processing
                        if self.process_campaign_callback:
                            asyncio.create_task(self.process_campaign_callback(campaign_id))
                        else:
                            print(f"✗ No process callback set for campaign {campaign_id}")
                    
                    except Exception as e:
                        print(f"✗ Error starting scheduled campaign {campaign.get('_id')}: {e}")
                        traceback.print_exc()
                        
                        # Mark campaign as failed
                        try:
                            await campaign_db.update_campaign(
                                campaign["_id"],
                                {
                                    "status": "failed",
                                    "error_message": f"Failed to start scheduled campaign: {str(e)}",
                                    "completed_at": datetime.utcnow()
                                }
                            )
                        except:
                            pass
        
        except Exception as e:
            print(f"✗ Error in scheduler check: {e}")
            traceback.print_exc()
    
    async def run(self):
        """Main scheduler loop"""
        self.is_running = True
        print(f"✓ Campaign scheduler started (checking every {self.check_interval}s)")
        
        while self.is_running:
            try:
                await self.check_and_run_scheduled_campaigns()
            except Exception as e:
                print(f"✗ Scheduler error: {e}")
                traceback.print_exc()
            
            # Wait before next check
            await asyncio.sleep(self.check_interval)
        
        print("✓ Campaign scheduler stopped")
    
    def start(self):
        """Start the scheduler in background"""
        if not self._task or self._task.done():
            self._task = asyncio.create_task(self.run())
            return self._task
        else:
            print("Scheduler is already running")
    
    def stop(self):
        """Stop the scheduler"""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()


# Global scheduler instance
_scheduler: CampaignScheduler = None


def get_scheduler() -> CampaignScheduler:
    """Get the global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = CampaignScheduler(check_interval=60)  # Check every minute
    return _scheduler


def initialize_scheduler(process_callback: Callable):
    """Initialize and start the scheduler"""
    scheduler = get_scheduler()
    scheduler.set_process_callback(process_callback)
    scheduler.start()
    return scheduler
