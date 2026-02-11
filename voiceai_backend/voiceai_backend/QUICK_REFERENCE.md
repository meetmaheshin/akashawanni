# Wallet System - Quick Reference

## 🚀 Quick Start

```bash
# 1. Install Razorpay
pip install razorpay==1.4.2

# 2. Add to .env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key

# 3. Restart server
python main.py
```

## 💰 Key Amounts

- **Minimum Balance**: Rs. 10 (required before calls)
- **Minimum Recharge**: Rs. 10
- **Default Call Rate**: Rs. 10 per minute

## 🔑 Common API Calls

### Check Balance
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8800/api/wallet/balance
```

### Recharge Wallet (Full Flow)
```javascript
// 1. Get Razorpay key
const { razorpay_key } = await fetch('/api/payment/razorpay-key').then(r => r.json());

// 2. Create order
const { order } = await fetch('/api/payment/create-order', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 100 })
}).then(r => r.json());

// 3. Open Razorpay (in browser)
const razorpay = new Razorpay({
  key: razorpay_key,
  amount: order.amount_paise,
  order_id: order.order_id,
  handler: async (response) => {
    // 4. Verify payment
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
        amount: 100
      })
    });
  }
});
razorpay.open();
```

### View Transactions
```bash
# All transactions
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8800/api/transactions

# Only credits
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8800/api/transactions?transaction_type=credit

# Only debits
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8800/api/transactions?transaction_type=debit
```

### Download Transactions
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8800/api/transactions/download \
  -o transactions.csv
```

### Make Call (with balance check)
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890", "kb_id": "ailancers"}' \
  http://localhost:8800/api/call
```

### Set Call Rate (Admin Only)
```bash
curl -X POST \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:8800/api/wallet/set-call-rate?rate=15.0"
```

## 📊 Transaction Types

### Credit (Money In)
- Wallet recharge via Razorpay
- Manual credits (future feature)
- Promotional credits (future feature)

### Debit (Money Out)
- Call charges (auto-debited after call)
- Campaign charges
- Other services (future)

## ⚠️ Error Codes

| Code | Error | Solution |
|------|-------|----------|
| 402 | Insufficient balance | Recharge wallet |
| 400 | Invalid payment | Check payment details |
| 400 | Below minimum | Min Rs. 10 required |
| 503 | Service unavailable | Configure Razorpay |

## 🧪 Test Cards (Test Mode)

| Card Number | Result |
|-------------|--------|
| 4111 1111 1111 1111 | Success |
| 4000 0000 0000 0002 | Failure |

Any CVV, any future expiry date.

## 📁 Files Overview

```
wallet.py           → Wallet database operations
transactions.py     → Transaction tracking
payments.py         → Razorpay integration
main.py            → API endpoints (updated)
users.py           → User creation (updated)
requirements.txt   → Dependencies (updated)
```

## 🔄 Call Billing Flow

1. User makes call → Balance checked (min Rs. 10)
2. If insufficient → 402 error
3. If sufficient → Call proceeds
4. Call ends → Duration recorded
5. Cost calculated → `(seconds / 60) * rate`
6. Amount debited → Wallet updated
7. Transaction created → Audit trail

## 💡 Pro Tips

1. **Frontend**: Show wallet balance in header
2. **Warning**: Alert when balance < Rs. 20
3. **Auto-reload**: Suggest recharge before campaigns
4. **Analytics**: Show spending trends to users
5. **Admin**: Monitor low-balance users

## 🔍 Debugging

```bash
# Check wallet exists
db.wallets.find({ user_id: "USER_ID" })

# Check transactions
db.transactions.find({ user_id: "USER_ID" }).sort({ created_at: -1 })

# Check call rate
db.wallet_settings.find({ key: "call_rate_per_minute" })

# View all wallets
db.wallets.find()
```

## 📞 Common Scenarios

### Scenario 1: New User
```
1. Sign up → Wallet created (Rs. 0)
2. Try call → Error (insufficient balance)
3. Recharge Rs. 100 → Success
4. Balance now Rs. 100
```

### Scenario 2: Making Calls
```
1. Balance: Rs. 100
2. 3-minute call → Rs. 30 debited
3. Balance: Rs. 70
4. Transaction recorded
```

### Scenario 3: Campaign
```
1. Balance: Rs. 100
2. 10 calls × 2 min each → Rs. 200 needed
3. Only first 5 calls complete
4. Balance: Rs. 0
5. Remaining calls need recharge
```

## 🎯 Best Practices

1. **Always check balance** before allowing calls
2. **Show cost estimate** before campaigns
3. **Alert low balance** proactively
4. **Provide transaction history** for transparency
5. **Test with Razorpay test mode** first
6. **Monitor payment failures** in production

## 📚 Documentation

- **API Reference**: WALLET_API_DOCUMENTATION.md
- **User Guide**: WALLET_README.md
- **Implementation**: IMPLEMENTATION_SUMMARY.md
- **This File**: Quick reference

## 🆘 Quick Troubleshooting

**Problem**: Payment not working
- Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env
- Verify test/live mode matches
- Check Razorpay dashboard for errors

**Problem**: Balance not updating
- Check payment was verified (signature valid)
- Check MongoDB connection
- Review server logs for errors

**Problem**: Auto-debit not working
- Verify call completed successfully
- Check user_id in call record
- Ensure balance was sufficient
- Review server logs

## 📈 Monitoring Queries

```javascript
// Total system balance
db.wallets.aggregate([
  { $group: { _id: null, total: { $sum: "$balance" } } }
])

// Today's transactions
db.transactions.find({
  created_at: { $gte: new Date("2026-02-10") }
})

// Top spenders
db.transactions.aggregate([
  { $match: { transaction_type: "debit" } },
  { $group: { _id: "$user_id", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])
```

---

**Version**: 1.0  
**Last Updated**: February 10, 2026  
**Support**: See WALLET_README.md
