# 🔧 Quick Fix for Startup Issues

## Problem: "ModuleNotFoundError: No module named 'fastapi'"

This happens when dependencies are installed but the script runs Python outside the virtual environment.

## ✅ Solution (Choose One)

### Option 1: Use the new run.sh script (Recommended)

```bash
cd backend
./run.sh
```

This script:
- Always installs dependencies fresh
- Uses explicit venv Python path
- Verifies installation before starting

### Option 2: Manual setup

```bash
cd backend

# Remove old venv if it exists
rm -rf voiceai_venv venv

# Create fresh virtual environment
python3 -m venv voiceai_venv

# Activate it
source voiceai_venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install all dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, motor, pymongo; print('✓ All packages installed')"

# Start server
python main.py
```

### Option 3: Use the updated start.sh

```bash
cd backend
./start.sh
```

The start.sh has been updated to:
- Always install dependencies (not just check for uvicorn)
- Verify FastAPI is installed before starting
- Use proper venv activation

## 🔍 Troubleshooting

### 1. Check if virtual environment is active

```bash
which python
# Should show: /path/to/voiceai/backend/voiceai_venv/bin/python
```

### 2. Verify packages are installed

```bash
cd backend
source voiceai_venv/bin/activate
pip list | grep fastapi
```

Should show:
```
fastapi       0.104.1
```

### 3. Clean install

```bash
cd backend
rm -rf voiceai_venv
python3 -m venv voiceai_venv
source voiceai_venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python main.py
```

### 4. Check Python version

```bash
python3 --version
```

Should be Python 3.8 or higher.

### 5. Install system dependencies (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install python3-pip python3-venv python3-dev
```

## 🚀 Quick Start Commands

### Start Backend (Easy Way)
```bash
cd backend
./run.sh
```

### Start Backend (Manual Way)
```bash
cd backend
source voiceai_venv/bin/activate
python main.py
```

## 📦 Required Packages

Make sure these are in requirements.txt:
```
fastapi==0.104.1
uvicorn==0.24.0
motor==3.3.2
pymongo==4.6.1
twilio==8.10.0
groq==0.4.1
deepgram-sdk==3.2.0
# ... and others
```

## ⚠️ Common Issues

### Issue: "source: not found"

**Solution**: You're using `sh` instead of `bash`
```bash
bash start.sh
# or
bash run.sh
```

### Issue: "Permission denied"

**Solution**: Make script executable
```bash
chmod +x start.sh run.sh
```

### Issue: Dependencies take too long

**Solution**: Use a package cache or install specific packages:
```bash
pip install fastapi uvicorn motor pymongo --no-cache-dir
```

### Issue: "No module named 'motor'"

**Solution**: MongoDB packages missing
```bash
source voiceai_venv/bin/activate
pip install motor pymongo
```

## ✅ Verification Checklist

After fixing, verify:

```bash
cd backend
source voiceai_venv/bin/activate

# Check Python location
which python
# Should show: .../voiceai_venv/bin/python

# Check FastAPI
python -c "import fastapi; print('FastAPI:', fastapi.__version__)"

# Check Motor
python -c "import motor; print('Motor installed')"

# Check all imports from main.py
python -c "
from fastapi import FastAPI, WebSocket
from motor.motor_asyncio import AsyncIOMotorClient
from groq import Groq
from deepgram import DeepgramClient
print('✓ All imports successful')
"

# Now start the server
python main.py
```

## 🎯 Expected Output

When successful, you should see:
```
✓ MongoDB connected successfully
✓ KB pre-loaded
✓ Cartesia WebSocket connected (persistent)
✓ All connections pre-initialized
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8800 (Press CTRL+C to quit)
```

## 📞 Still Having Issues?

1. Check if MongoDB is running:
   ```bash
   sudo systemctl status mongod
   ```

2. Verify .env file exists and has all keys:
   ```bash
   cat .env | grep -E "GROQ|DEEPGRAM|CARTESIA|MONGODB"
   ```

3. Try the manual installation steps above

4. Check the logs for specific errors

---

**Use `./run.sh` for the most reliable startup!** 🚀
