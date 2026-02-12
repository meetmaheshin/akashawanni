# Campaign Scheduling Feature - Implementation Guide

## Overview
Added campaign scheduling functionality that allows users to schedule campaigns for a specific time or run them immediately (current behavior).

## What's New

### Backend Changes

#### 1. Database Schema Updates (`campaigns.py`)
- **New Fields:**
  - `is_scheduled` (bool): Whether the campaign is scheduled
  - `scheduled_time` (datetime): When the campaign should start
  - `status`: New value "scheduled" for scheduled campaigns

- **Modified Methods:**
  - `create_campaign()`: Now accepts `is_scheduled` and `scheduled_time` parameters
  - `get_campaign()`: Returns scheduled_time in ISO format
  - `get_all_campaigns()`: Returns scheduled_time in ISO format
  - **New Method:** `get_scheduled_campaigns_to_run()`: Gets campaigns ready to execute

#### 2. Campaign Scheduler (`scheduler.py`) - NEW FILE
A background service that checks for scheduled campaigns and runs them at the specified time.

**Features:**
- Runs every 60 seconds (configurable)
- Checks for campaigns where `status="scheduled"` and `scheduled_time <= current_time`
- Automatically starts campaigns at scheduled time
- Handles errors gracefully with proper logging
- Updates campaign status appropriately

**Key Components:**
- `CampaignScheduler` class: Background task runner
- `initialize_scheduler()`: Initializes and starts the scheduler
- `get_scheduler()`: Returns global scheduler instance

#### 3. API Updates (`main.py`)
- **Imports:** Added scheduler module imports
- **Startup:** Initializes scheduler in `lifespan()` function
- **Shutdown:** Stops scheduler gracefully

**Modified Endpoints:**
- `POST /api/campaigns`: 
  - New params: `is_scheduled`, `scheduled_time` (ISO format)
  - Validates scheduled time is in the future
  - Starts immediately if not scheduled, otherwise saves for later

- `POST /api/campaigns/upload`:
  - Same scheduling parameters as above
  - Handles scheduling for file-based campaign creation

### Frontend Changes (`Campaigns.jsx`)

#### 1. New State Variables
```javascript
const [isScheduled, setIsScheduled] = useState(false);
const [scheduledDate, setScheduledDate] = useState('');
const [scheduledTime, setScheduledTime] = useState('');
```

#### 2. Campaign Creation Modal
- **New Section:** "Campaign Execution" toggle
  - "Run Immediately" button (default)
  - "Schedule for Later" button

- **Conditional Date/Time Picker:**
  - Shows when "Schedule for Later" is selected
  - Date input (min: today)
  - Time input
  - Purple-themed styling to match "scheduled" status

#### 3. Campaign Display
- **Status Badge:** New purple badge for "scheduled" status
- **Scheduled Time Display:** Shows scheduled date/time for scheduled campaigns
- **Updated Status Colors:** Added purple for scheduled campaigns

#### 4. Form Validation
- Validates both date and time are selected for scheduled campaigns
- Validates scheduled time is in the future
- Combines date and time into ISO format string

## Usage

### Creating an Immediate Campaign (Current Behavior)
1. Click "Create Campaign"
2. Fill in campaign details
3. Select "Run Immediately" (default)
4. Click "Create Campaign"
5. Campaign starts processing immediately

### Creating a Scheduled Campaign (New Feature)
1. Click "Create Campaign"
2. Fill in campaign details
3. Select "Schedule for Later"
4. Select date and time
5. Click "Create Campaign"
6. Campaign status shows as "SCHEDULED" with scheduled time
7. Campaign will automatically start at the scheduled time

## Technical Details

### Scheduling Flow
```
1. User creates campaign with schedule
   ↓
2. Backend saves campaign with status="scheduled"
   ↓
3. Scheduler runs every 60 seconds
   ↓
4. Scheduler finds campaigns where scheduled_time <= now
   ↓
5. Scheduler changes status to "pending"
   ↓
6. Scheduler calls process_campaign()
   ↓
7. Campaign executes normally
```

### Datetime Handling
- **Frontend:** User selects date and time, combined into ISO format string
- **Backend:** Parses ISO string to datetime object, validates future time
- **Database:** Stores as datetime object
- **Display:** Converts back to ISO format for frontend

### Status Flow
```
scheduled → pending → processing → completed/failed
```

### Scheduler Configuration
- Check interval: 60 seconds (1 minute)
- Configurable in `scheduler.py`
- Runs as background asyncio task
- Starts on app startup, stops on shutdown

## Error Handling

### Backend
- Invalid datetime format → 400 error with message
- Scheduled time in past → 400 error with message
- Scheduler errors logged but don't crash the app
- Failed campaign status update → logged and continues

### Frontend
- Missing date/time for scheduled → Error message
- Time in past → Error message
- API errors → User-friendly error display

## Status Colors
- **Green:** Completed
- **Blue:** Processing
- **Yellow:** Pending
- **Purple:** Scheduled (NEW)
- **Red:** Failed

## Files Modified
1. `/voiceai_backend/voiceai_backend/campaigns.py` - Database schema and methods
2. `/voiceai_backend/voiceai_backend/scheduler.py` - NEW: Background scheduler
3. `/voiceai_backend/voiceai_backend/main.py` - API endpoints and scheduler integration
4. `/voiceai_frontend/voiceai_frontend/src/components/Campaigns.jsx` - UI updates

## Testing

### Test Immediate Campaign
1. Create campaign without scheduling
2. Verify it starts immediately
3. Check status changes from pending → processing → completed

### Test Scheduled Campaign
1. Create campaign with schedule (e.g., 2 minutes in future)
2. Verify status shows "SCHEDULED" with correct time
3. Wait for scheduled time
4. Verify campaign starts automatically
5. Check status changes from scheduled → pending → processing → completed

### Test Validation
1. Try scheduling in the past → Should show error
2. Try scheduling without date/time → Should show error
3. Try invalid datetime format → Should show error

## Future Enhancements
- Edit scheduled campaigns
- Cancel scheduled campaigns
- Timezone support for international users
- Recurring campaigns
- Email notifications before campaign starts
- Calendar view of scheduled campaigns

## Notes
- Scheduler checks every 60 seconds, so campaigns may start up to 59 seconds late
- All times are stored in UTC in the database
- Frontend displays in local timezone
- Minimum wallet balance check still applies at creation time
