#!/bin/bash

# Wallet & Payment System Setup Script

echo "=========================================="
echo "VoiceAI Wallet & Payment System Setup"
echo "=========================================="
echo ""

# Step 1: Install Razorpay
echo "Step 1: Installing Razorpay package..."
pip install razorpay==1.4.2

if [ $? -eq 0 ]; then
    echo "✓ Razorpay installed successfully"
else
    echo "✗ Failed to install Razorpay"
    exit 1
fi

echo ""

# Step 2: Check environment variables
echo "Step 2: Checking Razorpay configuration..."

if [ -f .env ]; then
    echo "✓ .env file found"
    
    if grep -q "RAZORPAY_KEY_ID" .env; then
        echo "✓ RAZORPAY_KEY_ID is configured"
    else
        echo "⚠️  RAZORPAY_KEY_ID not found in .env"
        echo ""
        echo "Please add to your .env file:"
        echo "RAZORPAY_KEY_ID=your_razorpay_key_id"
    fi
    
    if grep -q "RAZORPAY_KEY_SECRET" .env; then
        echo "✓ RAZORPAY_KEY_SECRET is configured"
    else
        echo "⚠️  RAZORPAY_KEY_SECRET not found in .env"
        echo ""
        echo "Please add to your .env file:"
        echo "RAZORPAY_KEY_SECRET=your_razorpay_secret_key"
    fi
else
    echo "✗ .env file not found"
    echo ""
    echo "Please create a .env file with the following variables:"
    echo "RAZORPAY_KEY_ID=your_razorpay_key_id"
    echo "RAZORPAY_KEY_SECRET=your_razorpay_secret_key"
    exit 1
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "New Features Added:"
echo "  ✓ Wallet system for all users"
echo "  ✓ Razorpay payment integration"
echo "  ✓ Automatic wallet debit after calls"
echo "  ✓ Transaction history & reporting"
echo "  ✓ Configurable call rates"
echo ""
echo "Default Settings:"
echo "  • Minimum wallet balance: Rs. 10"
echo "  • Minimum recharge amount: Rs. 10"
echo "  • Default call rate: Rs. 10 per minute"
echo ""
echo "Next Steps:"
echo "  1. Get Razorpay API keys from https://dashboard.razorpay.com/"
echo "  2. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env"
echo "  3. Restart the server"
echo "  4. Test wallet functionality"
echo ""
echo "Documentation:"
echo "  See WALLET_API_DOCUMENTATION.md for complete API reference"
echo ""
