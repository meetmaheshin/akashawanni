# Wallet & Payment System

## Overview

Complete wallet and payment integration for VoiceAI platform with Razorpay payment gateway.

## Features

✅ **Wallet Management**
- Automatic wallet creation for all users
- Real-time balance tracking
- Minimum balance enforcement (Rs. 10)

✅ **Payment Integration**
- Razorpay payment gateway
- Secure payment verification
- Minimum recharge: Rs. 10

✅ **Call Billing**
- Configurable per-minute rate (default: Rs. 10/min)
- Automatic debit after call completion
- Balance check before calls/campaigns

✅ **Transaction Management**
- Complete transaction history
- Credit/debit tracking
- CSV export functionality
- User and admin views

## Quick Start

### 1. Install Dependencies

```bash
cd voiceai_backend/voiceai_backend
chmod +x setup_wallet.sh
./setup_wallet.sh
```

Or manually:
```bash
pip install razorpay==1.4.2
```

### 2. Configure Razorpay

Get your API keys from [Razorpay Dashboard](https://dashboard.razorpay.com/)

Add to `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key
```

For testing, use Razorpay Test Mode credentials.

### 3. Start Server

```bash
python main.py
```

The server will automatically:
- Initialize wallet database
- Initialize transaction database
- Create wallets for existing users (if any)

## File Structure

```
voiceai_backend/
├── wallet.py              # Wallet database operations
├── transactions.py        # Transaction database operations
├── payments.py            # Razorpay integration
├── main.py               # Updated with wallet endpoints
├── requirements.txt      # Added razorpay
├── setup_wallet.sh       # Setup script
├── WALLET_API_DOCUMENTATION.md  # Complete API docs
└── WALLET_README.md      # This file
```

## Database Collections

### 1. Wallets
Stores user wallet balances
```javascript
{
  user_id: "unique_user_id",
  balance: 150.50,
  currency: "INR",
  created_at: Date,
  updated_at: Date
}
```

### 2. Transactions
Tracks all wallet transactions
```javascript
{
  user_id: "user_id",
  transaction_type: "credit" | "debit",
  amount: 500.0,
  description: "Wallet recharge via Razorpay",
  payment_id: "pay_xxxxx",
  payment_method: "razorpay",
  call_sid: "CA123456",
  campaign_id: "campaign_id",
  metadata: {},
  created_at: Date
}
```

### 3. Wallet Settings
Stores configurable settings
```javascript
{
  key: "call_rate_per_minute",
  value: 10.0,
  updated_at: Date
}
```

## API Endpoints

### Wallet
- `GET /api/wallet/balance` - Get current balance
- `GET /api/wallet/call-rate` - Get per-minute rate
- `POST /api/wallet/set-call-rate` - Update rate (admin only)

### Payments
- `GET /api/payment/razorpay-key` - Get Razorpay public key
- `POST /api/payment/create-order` - Create payment order
- `POST /api/payment/verify` - Verify and process payment

### Transactions
- `GET /api/transactions` - Get transaction history
- `GET /api/transactions/download` - Download as CSV

See [WALLET_API_DOCUMENTATION.md](./WALLET_API_DOCUMENTATION.md) for detailed API reference.

## Workflow

### User Flow

1. **Sign Up** → Wallet automatically created with Rs. 0
2. **Recharge Wallet** → Add money via Razorpay (min Rs. 10)
3. **Make Call** → System checks balance (min Rs. 10 required)
4. **Call Ends** → Charges auto-debited based on duration
5. **View History** → See all transactions

### Admin Flow

1. **Configure Rate** → Set per-minute call rate
2. **View All Transactions** → Monitor all user transactions
3. **Download Reports** → Export transaction data

## Testing

### Test Mode Setup

1. Use Razorpay test credentials
2. Test cards:
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: Any 3 digits

### Test Scenarios

```bash
# 1. Check balance (should be 0 for new users)
curl -H "Authorization: Bearer <token>" \
  http://localhost:8800/api/wallet/balance

# 2. Try making a call (should fail - insufficient balance)
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890"}' \
  http://localhost:8800/api/call

# 3. Create payment order
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' \
  http://localhost:8800/api/payment/create-order

# 4. Complete payment via Razorpay UI

# 5. Check balance again (should be Rs. 100)
curl -H "Authorization: Bearer <token>" \
  http://localhost:8800/api/wallet/balance

# 6. Make a call (should succeed)
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890"}' \
  http://localhost:8800/api/call

# 7. After call, check transactions
curl -H "Authorization: Bearer <token>" \
  http://localhost:8800/api/transactions
```

## Configuration

### Call Rate

Default: Rs. 10 per minute

To change (admin only):
```bash
curl -X POST -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8800/api/wallet/set-call-rate?rate=15.0"
```

### Minimum Balance

Default: Rs. 10 (hardcoded in `wallet.py`)

To change, edit `wallet.py`:
```python
async def has_minimum_balance(self, user_id: str, minimum: float = 10.0)
```

### Minimum Recharge

Default: Rs. 10 (hardcoded in `payments.py`)

To change, edit `payments.py`:
```python
class PaymentService:
    MINIMUM_AMOUNT = 10.0
```

## Security

1. **Payment Verification**: All payments verified via Razorpay signature
2. **Duplicate Prevention**: Payment IDs checked to prevent double-processing
3. **Authorization**: Users can only access their own wallet/transactions
4. **Admin Protection**: Rate configuration restricted to admin role
5. **Balance Checks**: Atomic operations prevent negative balances

## Error Handling

| Code | Meaning | Solution |
|------|---------|----------|
| 402 | Insufficient balance | Recharge wallet |
| 400 | Invalid payment | Check payment details |
| 503 | Razorpay not configured | Add API keys to .env |
| 401 | Unauthorized | Login required |
| 403 | Forbidden | Admin access required |

## Troubleshooting

### Payment Not Working

1. Check Razorpay credentials in `.env`
2. Verify test/live mode matches
3. Check network connectivity
4. Review Razorpay dashboard logs

### Balance Not Updating

1. Check transaction was verified successfully
2. Verify payment signature was valid
3. Check MongoDB connection
4. Review server logs

### Auto-Debit Not Working

1. Check call completed successfully
2. Verify user_id in call record
3. Check wallet has sufficient balance
4. Review server logs for errors

## Migration

For existing users without wallets:

```python
# Run this script once
from wallet import get_wallet_db
from users import get_user_db

async def create_wallets_for_existing_users():
    user_db = get_user_db()
    wallet_db = get_wallet_db()
    
    users = await user_db.get_all_users(limit=1000)
    
    for user in users:
        try:
            await wallet_db.create_wallet(user["_id"], initial_balance=0.0)
            print(f"✓ Wallet created for {user['email']}")
        except Exception as e:
            print(f"✗ Error for {user['email']}: {e}")
```

## Production Checklist

- [ ] Switch to Razorpay Live credentials
- [ ] Set appropriate minimum balance
- [ ] Configure call rate
- [ ] Test payment flow end-to-end
- [ ] Set up webhook for payment notifications (optional)
- [ ] Configure backup for wallet/transaction data
- [ ] Monitor transaction logs
- [ ] Set up alerts for low balances
- [ ] Implement refund mechanism (if needed)

## Support

For issues:
1. Check logs: `tail -f server.log`
2. Verify environment variables
3. Test with Razorpay test mode
4. Review API documentation
5. Check MongoDB collections

## License

Same as main project.
