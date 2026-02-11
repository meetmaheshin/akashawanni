import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, Plus, X, TrendingUp, TrendingDown, Download } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const WalletWidget = () => {
  const [balance, setBalance] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const loadBalance = async () => {
    try {
      const response = await axios.get('/api/wallet/balance');
      setBalance(response.data.balance);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  return (
    <>
      <div className="relative group">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
        >
          <Wallet className="w-5 h-5" />
          <div className="flex flex-col items-start">
            <span className="text-xs opacity-90">Wallet</span>
            <span className="font-bold">₹{balance.toFixed(2)}</span>
          </div>
        </button>
        
        {/* Low balance indicator */}
        {balance < 10 && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {showModal && createPortal(
        <WalletModal 
          balance={balance} 
          onClose={() => setShowModal(false)} 
          onBalanceUpdate={loadBalance}
        />,
        document.body
      )}
    </>
  );
};

const WalletModal = ({ balance, onClose, onBalanceUpdate }) => {
  const [activeTab, setActiveTab] = useState('recharge');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [callRate, setCallRate] = useState(10);
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions();
    }
    loadCallRate();
  }, [activeTab]);

  const loadCallRate = async () => {
    try {
      const response = await axios.get('/api/wallet/call-rate');
      setCallRate(response.data.rate_per_minute);
    } catch (error) {
      console.error('Failed to load call rate:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await axios.get('/api/transactions?limit=20');
      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const quickAmounts = [100, 200, 500, 1000];

  const handleRecharge = async () => {
    const rechargeAmount = parseFloat(amount);
    
    if (!rechargeAmount || rechargeAmount < 10) {
      alert('Minimum recharge amount is ₹10');
      return;
    }

    setLoading(true);

    try {
      // Get Razorpay key
      const keyResponse = await axios.get('/api/payment/razorpay-key');
      const razorpayKey = keyResponse.data.razorpay_key;

      // Create order
      const orderResponse = await axios.post('/api/payment/create-order', {
        amount: rechargeAmount
      });
      const order = orderResponse.data.order;

      // Initialize Razorpay
      const options = {
        key: razorpayKey,
        amount: order.amount_paise,
        currency: order.currency,
        name: 'VoiceAI',
        description: 'Wallet Recharge',
        order_id: order.order_id,
        handler: async (response) => {
          try {
            // Verify payment
            await axios.post('/api/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: rechargeAmount
            });

            alert(`₹${rechargeAmount} added to wallet successfully!`);
            onBalanceUpdate();
            setAmount('');
            setActiveTab('transactions');
          } catch (error) {
            console.error('Payment verification failed:', error);
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: 'User',
          email: 'user@example.com'
        },
        theme: {
          color: '#10B981'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Failed to create order:', error);
      alert(error.response?.data?.detail || 'Failed to create payment order');
    } finally {
      setLoading(false);
    }
  };

  const downloadTransactions = async () => {
    try {
      const token = localStorage.getItem('voiceai_token');
      window.open(`/api/transactions/download?token=${token}`, '_blank');
    } catch (error) {
      console.error('Failed to download transactions:', error);
    }
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-60 flex items-center justify-center p-4" 
      style={{ zIndex: 999999, position: 'fixed' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden relative" 
        style={{ zIndex: 1000000, maxHeight: '90vh', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Wallet className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">My Wallet</h2>
                <p className="text-sm opacity-90">Manage your wallet balance</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Balance Display */}
          <div className="mt-6 bg-white bg-opacity-20 rounded-xl p-4">
            <div className="text-sm opacity-90">Current Balance</div>
            <div className="text-4xl font-bold mt-1">₹{balance.toFixed(2)}</div>
            <div className="text-sm mt-2 opacity-90">
              Call Rate: ₹{callRate}/min {balance < 10 && (
                <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                  Low Balance
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('recharge')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'recharge'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Add Money
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline mr-2" />
            Transactions
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 300px)' }}>
          {activeTab === 'recharge' ? (
            <div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Amount (Min ₹10)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  min="10"
                  step="10"
                />
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Quick Add</p>
                <div className="grid grid-cols-4 gap-3">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt.toString())}
                      className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors font-medium text-gray-700 hover:text-green-600"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRecharge}
                disabled={loading || !amount || parseFloat(amount) < 10}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? 'Processing...' : `Add ₹${amount || '0'} to Wallet`}
              </button>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You'll be redirected to Razorpay for secure payment. 
                  Minimum recharge amount is ₹10.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
                <button
                  onClick={downloadTransactions}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Wallet className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((txn) => (
                    <div
                      key={txn._id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          txn.transaction_type === 'credit' 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {txn.transaction_type === 'credit' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{txn.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(txn.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${
                        txn.transaction_type === 'credit' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {txn.transaction_type === 'credit' ? '+' : '-'}₹{txn.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletWidget;
