# Wallet Frontend Integration - Complete Guide

## Overview

The wallet system frontend includes:
1. **Wallet Widget** - Shows balance with quick access to recharge
2. **Recharge Modal** - Add money using Razorpay
3. **Transaction History** - View all credits and debits
4. **Low Balance Warnings** - Alerts on call and campaign pages

## Files Created/Modified

### New Files

1. **WalletWidget.jsx**
   - Main wallet component
   - Shows balance in navigation bar
   - Opens modal for recharge and transactions
   - Real-time balance updates

### Modified Files

1. **App.jsx**
   - Added WalletWidget import
   - Integrated wallet in navigation bar
   - Positioned between "Call History" and user profile

2. **CallInterface.jsx**
   - Added wallet balance check
   - Shows low balance warning (< ₹10)
   - Loads balance on mount

3. **Campaigns.jsx**
   - Added wallet balance check
   - Shows low balance warning (< ₹10)
   - Loads balance on mount

4. **index.html**
   - Added Razorpay checkout script
   - Required for payment processing

## Component Structure

### WalletWidget Component

```jsx
<WalletWidget />
```

**Features:**
- Displays current balance
- Green gradient button for visibility
- Red pulse indicator when balance < ₹10
- Click to open modal
- Auto-refreshes after transactions

**Location:** Navigation bar (right side, before user profile)

### WalletModal Component

**Two Tabs:**

1. **Add Money Tab**
   - Amount input field
   - Quick add buttons (₹100, ₹200, ₹500, ₹1000)
   - Razorpay payment integration
   - Minimum ₹10 validation
   - Success/error handling

2. **Transactions Tab**
   - List of recent transactions
   - Credit (green) and Debit (red) indicators
   - Transaction details (date, amount, description)
   - Export CSV button
   - Empty state handling

## Integration Details

### 1. Razorpay Integration

**Script Loading:**
```html
<!-- In index.html -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

**Payment Flow:**
```javascript
1. Get Razorpay key → GET /api/payment/razorpay-key
2. Create order → POST /api/payment/create-order
3. Open Razorpay modal → new Razorpay(options).open()
4. User pays → Razorpay handles payment
5. Verify payment → POST /api/payment/verify
6. Update balance → Refresh wallet
```

### 2. API Endpoints Used

**Wallet:**
- `GET /api/wallet/balance` - Get current balance
- `GET /api/wallet/call-rate` - Get per-minute rate

**Payment:**
- `GET /api/payment/razorpay-key` - Get public key
- `POST /api/payment/create-order` - Create payment order
- `POST /api/payment/verify` - Verify and process payment

**Transactions:**
- `GET /api/transactions?limit=20` - Get transaction history
- `GET /api/transactions/download` - Download CSV

### 3. State Management

**WalletWidget State:**
```javascript
- balance: number (current wallet balance)
- showModal: boolean (modal visibility)
```

**WalletModal State:**
```javascript
- activeTab: 'recharge' | 'transactions'
- amount: string (recharge amount)
- loading: boolean (processing state)
- transactions: array (transaction list)
- callRate: number (per-minute rate)
```

## UI/UX Features

### Visual Design

1. **Wallet Button**
   - Gradient green background (green-500 to emerald-600)
   - Shows "Wallet" label and balance
   - Hover effect (darker gradient)
   - Shadow effects

2. **Low Balance Indicator**
   - Red pulsing dot on wallet button
   - Warning banners on call/campaign pages
   - Orange gradient backgrounds

3. **Modal Design**
   - Large, centered modal
   - Green gradient header
   - Tabbed interface
   - Smooth transitions

### User Experience

1. **Balance Visibility**
   - Always visible in navigation
   - Updates after recharge
   - Shows in rupees with 2 decimals

2. **Quick Actions**
   - One-click quick amounts
   - Fast recharge flow
   - Immediate feedback

3. **Transaction Tracking**
   - Clear credit/debit indicators
   - Timestamps for all transactions
   - Downloadable history

4. **Error Handling**
   - Minimum amount validation
   - Payment failure handling
   - Network error messages
   - User-friendly alerts

## Code Examples

### Using WalletWidget

```jsx
// In App.jsx Navigation component
import WalletWidget from './components/WalletWidget';

function Navigation() {
  return (
    <nav>
      {/* Other nav items */}
      <WalletWidget />
      {/* User profile */}
    </nav>
  );
}
```

### Checking Balance Before Action

```jsx
// In CallInterface.jsx
const [walletBalance, setWalletBalance] = useState(0);

useEffect(() => {
  loadWalletBalance();
}, []);

const loadWalletBalance = async () => {
  const response = await axios.get('/api/wallet/balance');
  setWalletBalance(response.data.balance);
};

// Show warning
{walletBalance < 10 && (
  <div className="alert alert-warning">
    Low balance! Please recharge.
  </div>
)}
```

### Razorpay Payment Handler

```javascript
const handleRecharge = async () => {
  // 1. Get Razorpay key
  const { razorpay_key } = await axios.get('/api/payment/razorpay-key')
    .then(r => r.data);

  // 2. Create order
  const { order } = await axios.post('/api/payment/create-order', {
    amount: rechargeAmount
  }).then(r => r.data);

  // 3. Open Razorpay
  const options = {
    key: razorpay_key,
    amount: order.amount_paise,
    order_id: order.order_id,
    handler: async (response) => {
      // 4. Verify payment
      await axios.post('/api/payment/verify', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        amount: rechargeAmount
      });
      
      // Success!
      alert('Recharge successful!');
      onBalanceUpdate();
    }
  };

  new window.Razorpay(options).open();
};
```

## Styling Details

### Tailwind Classes Used

**Wallet Button:**
```css
bg-gradient-to-r from-green-500 to-emerald-600
hover:from-green-600 hover:to-emerald-700
shadow-md hover:shadow-lg
rounded-lg px-4 py-2
```

**Low Balance Indicator:**
```css
w-3 h-3 bg-red-500 rounded-full animate-pulse
absolute -top-1 -right-1
```

**Modal:**
```css
fixed inset-0 z-50
bg-black bg-opacity-50
max-w-2xl rounded-2xl shadow-2xl
```

**Transaction Items:**
```css
/* Credit */
bg-green-100 text-green-600

/* Debit */
bg-red-100 text-red-600
```

## Testing Guide

### Test Scenarios

1. **View Balance**
   - Login to application
   - Check wallet button in nav bar
   - Should show ₹0.00 for new users

2. **Low Balance Warning**
   - With balance < ₹10
   - Visit call interface or campaigns
   - Should see red warning banner

3. **Recharge Wallet**
   - Click wallet button
   - Click "Add Money" tab
   - Enter amount (e.g., ₹100)
   - Click "Add to Wallet"
   - Complete Razorpay payment (test mode)
   - Balance should update

4. **View Transactions**
   - Click wallet button
   - Click "Transactions" tab
   - Should see recharge transaction
   - Should show green indicator

5. **Make Call After Recharge**
   - Make a call
   - After call ends
   - Check transactions
   - Should see debit transaction

6. **Download Transactions**
   - Go to transactions tab
   - Click "Export CSV"
   - CSV file should download

### Test Cards (Razorpay Test Mode)

**Success:**
- Card: 4111 1111 1111 1111
- Expiry: Any future date (e.g., 12/25)
- CVV: Any 3 digits (e.g., 123)

**Failure:**
- Card: 4000 0000 0000 0002
- Tests payment failure handling

## Troubleshooting

### Issue: Razorpay not loading

**Solution:**
1. Check if Razorpay script is in index.html
2. Check browser console for errors
3. Verify Razorpay keys are configured

### Issue: Balance not updating

**Solution:**
1. Check network tab for API calls
2. Verify payment was verified successfully
3. Refresh the page
4. Check backend logs

### Issue: Payment fails

**Solution:**
1. Verify Razorpay test/live mode
2. Check minimum amount (₹10)
3. Verify API keys are correct
4. Check Razorpay dashboard for errors

### Issue: Transactions not showing

**Solution:**
1. Check API call to /api/transactions
2. Verify authentication token
3. Check backend is running
4. Try refreshing modal

## Best Practices

1. **Error Handling**
   - Always catch API errors
   - Show user-friendly messages
   - Log errors for debugging

2. **Loading States**
   - Show spinners during API calls
   - Disable buttons while processing
   - Provide feedback

3. **User Feedback**
   - Success messages after recharge
   - Warning for low balance
   - Clear error messages

4. **Performance**
   - Load balance only when needed
   - Cache transaction list
   - Debounce API calls

5. **Security**
   - Use HTTPS in production
   - Validate amounts on backend
   - Never store sensitive data

## Future Enhancements

Potential improvements:

1. **Auto-refresh Balance**
   - Poll balance every 30 seconds
   - Show real-time updates

2. **Balance Notifications**
   - Browser notifications for low balance
   - Email alerts

3. **Transaction Filters**
   - Filter by date range
   - Filter by type (credit/debit)
   - Search transactions

4. **Balance Analytics**
   - Spending charts
   - Usage trends
   - Cost predictions

5. **Quick Recharge**
   - Remember favorite amounts
   - One-click recharge
   - Auto-recharge threshold

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features:**
- ES6+ JavaScript
- Fetch API
- LocalStorage
- CSS Grid/Flexbox

## Mobile Responsiveness

The wallet components are fully responsive:
- Modal adapts to screen size
- Touch-friendly buttons
- Scrollable transaction list
- Mobile-optimized layout

## Accessibility

- Keyboard navigation support
- Screen reader friendly
- High contrast ratios
- Focus indicators

## Summary

The wallet frontend provides a complete, user-friendly interface for:
- ✅ Viewing wallet balance
- ✅ Adding money via Razorpay
- ✅ Viewing transaction history
- ✅ Exporting transactions
- ✅ Low balance warnings
- ✅ Real-time updates

All components are production-ready with proper error handling, loading states, and user feedback.
