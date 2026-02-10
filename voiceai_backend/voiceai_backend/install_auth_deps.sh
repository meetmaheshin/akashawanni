#!/bin/bash
# Install required packages for VoiceAI authentication

echo "Installing VoiceAI authentication dependencies..."

pip3 install --user passlib[bcrypt] python-jose[cryptography] pydantic[email]

echo "✓ Authentication dependencies installed"
echo ""
echo "Note: If sentence_transformers or other packages are missing, install with:"
echo "  pip3 install --user -r requirements.txt"
