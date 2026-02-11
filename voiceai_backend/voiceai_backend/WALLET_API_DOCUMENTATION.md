# Wallet & Payment System API Documentation

## Overview

The VoiceAI platform now includes a complete wallet and payment system with Razorpay integration. Users must maintain a minimum balance of Rs. 10 to make calls or create campaigns. Calls are charged at a configurable rate (default Rs. 10 per minute).

## Environment Variables Required

Add these to your `.env` file:

```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## Key Features

1. **Automatic Wallet Creation**: Wallet is automatically created when a user signs up
2. **Minimum Balance**: Rs. 10 minimum to add to wallet
3. **Balance Check**: System checks for Rs. 10 minimum before allowing calls/campaigns
4. **Auto-Debit**: Charges are automatically deducted after each call
5. **Configurable Rate**: Admin can change the per-minute call rate
6. **Transaction History**: Complete audit trail of all credits and debits
7. **CSV Export**: Download transaction history as CSV

## API Endpoints

### Wallet Endpoints

#### 1. Get Wallet Balance
```
GET /api/wallet/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "balance": 150.50,
  "currency": "INR"
}
```

#### 2. Get Call Rate
```
GET /api/wallet/call-rate
```

**Response:**
```json
{
  "rate_per_minute": 10.0,
  "currency": "INR"
}
```

#### 3. Set Call Rate (Admin Only)
```
POST /api/wallet/set-call-rate?rate=15.0
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Call rate updated to Rs. 15.0 per minute",
  "rate_per_minute": 15.0
}
```

---

### Payment Endpoints (Razorpay)

#### 1. Get Razorpay Key
```
GET /api/payment/razorpay-key
```

**Response:**
```json
{
  "razorpay_key": "rzp_test_xxxxx"
}
```

#### 2. Create Payment Order
```
POST /api/payment/create-order
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500.0
}
```

**Response:**
```json
{
  "status": "success",
  "order": {
    "order_id": "order_xxxxx",
    "amount": 500.0,
    "amount_paise": 50000,
    "currency": "INR",
    "receipt": "wallet_recharge_user_id_timestamp"
  }
}
```

**Validations:**
- Minimum amount: Rs. 10

**Errors:**
- 400: Minimum recharge amount is Rs. 10
- 503: Payment service not configured

#### 3. Verify Payment
```
POST /api/payment/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature_xxxxx",
  "amount": 500.0
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Rs. 500.0 credited to wallet",
  "new_balance": 650.50
}
```

**Errors:**
- 400: Invalid payment signature
- 400: Payment already processed

---

### Transaction Endpoints

#### 1. Get Transactions
```
GET /api/transactions?transaction_type=credit&limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `transaction_type` (optional): "credit" or "debit"
- `limit` (default: 50): Number of records to fetch
- `offset` (default: 0): Pagination offset

**Response:**
```json
{
  "transactions": [
    {
      "_id": "txn_id",
      "user_id": "user_id",
      "transaction_type": "credit",
      "amount": 500.0,
      "description": "Wallet recharge via Razorpay",
      "payment_id": "pay_xxxxx",
      "payment_method": "razorpay",
      "call_sid": null,
      "campaign_id": null,
      "metadata": {
        "order_id": "order_xxxxx"
      },
      "created_at": "2026-02-10T10:30:00"
    },
    {
      "_id": "txn_id_2",
      "user_id": "user_id",
      "transaction_type": "debit",
      "amount": 5.50,
      "description": "Call charges (33.0s)",
      "payment_id": null,
      "payment_method": null,
      "call_sid": "CA123456",
      "campaign_id": "campaign_id",
      "metadata": {
        "duration_seconds": 33.0,
        "lead_status": "hot"
      },
      "created_at": "2026-02-10T10:35:00"
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0,
  "summary": {
    "total_credits": 1500.0,
    "total_debits": 850.0,
    "credit_count": 10,
    "debit_count": 35
  }
}
```

**Authorization:**
- **Users**: Can only see their own transactions
- **Admin**: Can see all users' transactions

#### 2. Download Transactions
```
GET /api/transactions/download?transaction_type=debit
Authorization: Bearer <token>
```

**Query Parameters:**
- `transaction_type` (optional): "credit" or "debit"

**Response:**
- CSV file download with filename: `transactions_<username>.csv` or `all_transactions.csv` (for admin)

**CSV Format:**
```csv
Date,Type,Amount (Rs.),Description,Payment ID,Call SID,Campaign ID
"2026-02-10T10:30:00","CREDIT",500.0,"Wallet recharge via Razorpay","pay_xxxxx","",""
"2026-02-10T10:35:00","DEBIT",5.50,"Call charges (33.0s)","","CA123456","campaign_id"
```

---

### Updated User Endpoint

#### Get Current User Info (includes wallet balance)
```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "wallet_balance": 150.50
}
```

---

### Updated Call/Campaign Endpoints

#### Make Call (with balance check)
```
POST /api/call
Authorization: Bearer <token>
```

**Errors:**
- **402 Payment Required**: Insufficient wallet balance

Example error response:
```json
{
  "detail": "Insufficient wallet balance. Current balance: Rs. 5.00. Minimum required: Rs. 10.00"
}
```

#### Create Campaign (with balance check)
```
POST /api/campaigns
Authorization: Bearer <token>
```

**Errors:**
- **402 Payment Required**: Insufficient wallet balance (same as above)

---

## Transaction Flow

### Recharge Wallet Flow

1. **Frontend**: Get Razorpay key
   ```
   GET /api/payment/razorpay-key
   ```

2. **Frontend**: Create order
   ```
   POST /api/payment/create-order
   Body: {"amount": 500}
   ```

3. **Frontend**: Initialize Razorpay checkout with order_id

4. **Razorpay**: User completes payment

5. **Frontend**: Verify payment
   ```
   POST /api/payment/verify
   Body: {
     "razorpay_order_id": "...",
     "razorpay_payment_id": "...",
     "razorpay_signature": "...",
     "amount": 500
   }
   ```

6. **Backend**: 
   - Verifies signature
   - Credits wallet
   - Creates transaction record
   - Returns new balance

### Call Debit Flow

1. **User**: Makes a call
   - System checks minimum balance (Rs. 10)
   - If insufficient, returns 402 error

2. **During Call**: Call proceeds normally

3. **After Call**:
   - System calculates cost: `(duration_seconds / 60) * rate_per_minute`
   - Debits amount from wallet
   - Creates debit transaction record
   - Updates call history with cost

---

## Database Schema

### Wallets Collection
```json
{
  "_id": "ObjectId",
  "user_id": "user_id",
  "balance": 150.50,
  "currency": "INR",
  "created_at": "2026-02-10T10:00:00",
  "updated_at": "2026-02-10T10:30:00"
}
```

### Transactions Collection
```json
{
  "_id": "ObjectId",
  "user_id": "user_id",
  "transaction_type": "credit|debit",
  "amount": 500.0,
  "description": "Wallet recharge via Razorpay",
  "payment_id": "pay_xxxxx",
  "payment_method": "razorpay",
  "call_sid": null,
  "campaign_id": null,
  "metadata": {},
  "created_at": "2026-02-10T10:30:00"
}
```

### Wallet Settings Collection
```json
{
  "_id": "ObjectId",
  "key": "call_rate_per_minute",
  "value": 10.0,
  "updated_at": "2026-02-10T10:00:00"
}
```

---

## Testing

### 1. Install Razorpay package
```bash
pip install razorpay==1.4.2
```

### 2. Configure Razorpay
Add to `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key
```

### 3. Test Wallet Creation
- Sign up a new user
- Wallet is automatically created with 0 balance

### 4. Test Payment (Test Mode)
Use Razorpay test credentials:
- Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVV: Any 3 digits

### 5. Test Balance Check
- Try making a call with 0 balance
- Should get 402 error
- Add money to wallet
- Call should succeed

### 6. Test Auto-Debit
- Make a call
- Check wallet balance before/after
- Verify transaction record created

---

## Frontend Integration Example (React)

```javascript
// 1. Check balance before allowing call
const { data: user } = await fetch('/api/auth/me', {
  headers: { Authorization: `Bearer ${token}` }
});

if (user.wallet_balance < 10) {
  alert('Insufficient balance. Please recharge.');
  return;
}

// 2. Recharge wallet
const rechargeWallet = async (amount) => {
  // Get Razorpay key
  const { razorpay_key } = await fetch('/api/payment/razorpay-key')
    .then(r => r.json());
  
  // Create order
  const { order } = await fetch('/api/payment/create-order', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount })
  }).then(r => r.json());
  
  // Initialize Razorpay
  const options = {
    key: razorpay_key,
    amount: order.amount_paise,
    currency: order.currency,
    order_id: order.order_id,
    handler: async (response) => {
      // Verify payment
      await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          amount: amount
        })
      });
      
      alert('Wallet recharged successfully!');
    }
  };
  
  const razorpay = new Razorpay(options);
  razorpay.open();
};

// 3. View transactions
const { transactions, summary } = await fetch('/api/transactions', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// 4. Download transactions
window.location.href = `/api/transactions/download?token=${token}`;
```

---

## Admin Features

1. **View All Transactions**: Admin can see all users' transactions
2. **Set Call Rate**: Admin can update the per-minute call rate
3. **Download All Transactions**: Admin can export all transactions

---

## Error Codes

- **400**: Bad request (invalid parameters, minimum amount not met)
- **401**: Unauthorized (invalid/missing token)
- **402**: Payment Required (insufficient balance)
- **403**: Forbidden (not authorized for action)
- **404**: Not found
- **500**: Internal server error
- **503**: Service unavailable (Razorpay not configured)

---

## Notes

1. All amounts are in INR (Indian Rupees)
2. Razorpay amounts are stored in paise (1 Rupee = 100 paise)
3. Call costs are calculated as: `(duration_seconds / 60) * rate_per_minute`
4. Costs are rounded to 2 decimal places
5. Transaction records are immutable (no updates/deletes)
6. Users can only see their own transactions and wallet
7. Admin can view all wallets and transactions
