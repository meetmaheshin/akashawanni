import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Phone, Megaphone, Search, Edit, Save, X, ChevronLeft, ChevronRight, Wallet, Settings, Filter, TrendingUp } from 'lucide-react';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [walletSettings, setWalletSettings] = useState({ call_rate_per_minute: 10, currency: 'INR' });
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editingWallet, setEditingWallet] = useState(null);
  const [editWalletAmount, setEditWalletAmount] = useState('');
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsFormData, setSettingsFormData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  
  // Filter states
  const [filters, setFilters] = useState({
    user_id: '',
    date_from: '',
    date_to: '',
    status: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    loadData();
  }, [activeTab, currentPage]);

  useEffect(() => {
    loadStatistics();
    loadAllUsers();
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await axios.get(`/api/admin/statistics`);
      setStatistics(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await axios.get(`/api/users`, {
        params: { limit: 1000, offset: 0 }
      });
      setAllUsers(response.data.users);
    } catch (error) {
      console.error('Error loading users list:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      
      if (activeTab === 'users') {
        const params = { limit: itemsPerPage, offset };
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        
        const response = await axios.get(`/api/users`, { params });
        setUsers(response.data.users);
        setTotalItems(response.data.total);
      } else if (activeTab === 'campaigns') {
        const params = { limit: itemsPerPage, offset };
        if (filters.user_id) params.user_id = filters.user_id;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        if (filters.status) params.status = filters.status;
        
        const response = await axios.get(`/api/admin/campaigns`, { params });
        setCampaigns(response.data.campaigns);
        setTotalItems(response.data.total);
      } else if (activeTab === 'callHistory') {
        const response = await axios.get(`/api/admin/call-history`, {
          params: { limit: itemsPerPage, offset }
        });
        setCallHistory(response.data.calls);
        setTotalItems(response.data.total);
      } else if (activeTab === 'wallets') {
        const response = await axios.get(`/api/admin/wallets`, {
          params: { limit: itemsPerPage, offset }
        });
        setWallets(response.data.wallets);
        setTotalItems(response.data.total);
      } else if (activeTab === 'settings') {
        const response = await axios.get(`/api/admin/wallet-settings`);
        setWalletSettings(response.data);
        setSettingsFormData({ call_rate_per_minute: response.data.call_rate_per_minute });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user._id);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      company_name: user.company_name || '',
      gstin: user.gstin || '',
      company_address: user.company_address || '',
      role: user.role || 'user',
      is_active: user.is_active ?? true
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFormData({});
  };

  const handleSaveUser = async (userId) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, editFormData);
      alert('User updated successfully');
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handleInputChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditWallet = (wallet) => {
    setEditingWallet(wallet.user_id);
    setEditWalletAmount(wallet.balance.toString());
  };

  const handleSaveWallet = async (userId) => {
    try {
      const amount = parseFloat(editWalletAmount);
      if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid amount');
        return;
      }
      
      await axios.put(`/api/admin/wallets/${userId}`, { amount });
      alert('Wallet balance updated successfully');
      setEditingWallet(null);
      loadData();
    } catch (error) {
      console.error('Error updating wallet:', error);
      alert('Failed to update wallet balance');
    }
  };

  const handleCancelWalletEdit = () => {
    setEditingWallet(null);
    setEditWalletAmount('');
  };

  const handleEditSettings = () => {
    setEditingSettings(true);
    setSettingsFormData({ call_rate_per_minute: walletSettings.call_rate_per_minute });
  };

  const handleSaveSettings = async () => {
    try {
      const rate = parseFloat(settingsFormData.call_rate_per_minute);
      if (isNaN(rate) || rate <= 0) {
        alert('Please enter a valid call rate');
        return;
      }
      
      await axios.put(`/api/admin/wallet-settings`, { call_rate_per_minute: rate });
      alert('Wallet settings updated successfully');
      setEditingSettings(false);
      loadData();
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update wallet settings');
    }
  };

  const handleCancelSettingsEdit = () => {
    setEditingSettings(false);
    setSettingsFormData({});
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadData();
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      date_from: '',
      date_to: '',
      status: ''
    });
    setCurrentPage(1);
    setTimeout(() => loadData(), 100);
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.knowledge_base_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCallHistory = callHistory.filter(call =>
    call.phone_number?.includes(searchTerm) ||
    call.knowledge_base_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWallets = wallets.filter(wallet =>
    wallet.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wallet.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass-effect rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Panel</h1>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Users</p>
                  <p className="text-3xl font-bold">{statistics.users.total}</p>
                  <p className="text-xs mt-1 opacity-80">+{statistics.users.today} today</p>
                </div>
                <Users className="w-12 h-12 opacity-50" />
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Campaigns</p>
                  <p className="text-3xl font-bold">{statistics.campaigns.total}</p>
                  <p className="text-xs mt-1 opacity-80">+{statistics.campaigns.today} today | {statistics.campaigns.active} active</p>
                </div>
                <Megaphone className="w-12 h-12 opacity-50" />
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Calls</p>
                  <p className="text-3xl font-bold">{statistics.calls.total}</p>
                  <p className="text-xs mt-1 opacity-80">+{statistics.calls.today} today</p>
                </div>
                <Phone className="w-12 h-12 opacity-50" />
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('users'); setCurrentPage(1); }}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Users</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('campaigns'); setCurrentPage(1); }}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'campaigns'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Megaphone className="w-5 h-5" />
            <span>Campaigns</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('callHistory'); setCurrentPage(1); }}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'callHistory'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Phone className="w-5 h-5" />
            <span>Call History</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('wallets'); setCurrentPage(1); }}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'wallets'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span>Wallets</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('settings'); setCurrentPage(1); }}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>

        {/* Filters Section */}
        {(activeTab === 'users' || activeTab === 'campaigns') && (
          <div className="mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
            </button>
            
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                    <input
                      type="date"
                      value={filters.date_from}
                      onChange={(e) => handleFilterChange('date_from', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                    <input
                      type="date"
                      value={filters.date_to}
                      onChange={(e) => handleFilterChange('date_to', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div className="flex items-end space-x-2">
                    <button
                      onClick={() => {
                        const today = getTodayDate();
                        handleFilterChange('date_from', today);
                        handleFilterChange('date_to', today);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      Today
                    </button>
                  </div>
                </div>
                
                {activeTab === 'campaigns' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Filter by User</label>
                      <select
                        value={filters.user_id}
                        onChange={(e) => handleFilterChange('user_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All Users</option>
                        {allUsers.map(user => (
                          <option key={user._id} value={user._id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                      <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={applyFilters}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Bar */}
        {activeTab !== 'settings' && (
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        )}

        {/* Users Table */}
        {!loading && activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    {editingUser === user._id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="email"
                            value={editFormData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editFormData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editFormData.company_name}
                            onChange={(e) => handleInputChange('company_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editFormData.role}
                            onChange={(e) => handleInputChange('role', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editFormData.is_active}
                            onChange={(e) => handleInputChange('is_active', e.target.value === 'true')}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveUser(user._id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Save className="w-5 h-5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.phone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.company_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.role === 'admin'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Campaigns Table */}
        {!loading && activeTab === 'campaigns' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Knowledge Base</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{campaign.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{campaign.user_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{campaign.user_email || '-'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{campaign.knowledge_base_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{campaign.total_calls || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        campaign.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : campaign.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : campaign.status === 'scheduled'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Call History Table */}
        {!loading && activeTab === 'callHistory' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Knowledge Base</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCallHistory.map((call) => (
                  <tr key={call._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{call.phone_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{call.knowledge_base_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {call.duration ? `${Math.round(call.duration)}s` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        call.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : call.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {call.started_at ? new Date(call.started_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">
                      {call.user_id?.substring(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Wallets Table */}
        {!loading && activeTab === 'wallets' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWallets.map((wallet) => (
                  <tr key={wallet._id} className="hover:bg-gray-50">
                    {editingWallet === wallet.user_id ? (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{wallet.user_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{wallet.user_email}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={editWalletAmount}
                            onChange={(e) => setEditWalletAmount(e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{wallet.currency}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {wallet.updated_at ? new Date(wallet.updated_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveWallet(wallet.user_id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Save className="w-5 h-5" />
                            </button>
                            <button
                              onClick={handleCancelWalletEdit}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{wallet.user_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{wallet.user_email}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{wallet.balance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{wallet.currency}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {wallet.updated_at ? new Date(wallet.updated_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEditWallet(wallet)}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Wallet Settings */}
        {!loading && activeTab === 'settings' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-800">Wallet Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call Rate Per Minute
                  </label>
                  {editingSettings ? (
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-700">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={settingsFormData.call_rate_per_minute}
                          onChange={(e) => setSettingsFormData({ call_rate_per_minute: e.target.value })}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">/ minute</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveSettings}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={handleCancelSettingsEdit}
                          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-gray-900">
                          ₹{walletSettings.call_rate_per_minute.toFixed(2)}
                        </span>
                        <span className="text-gray-600">per minute</span>
                      </div>
                      <button
                        onClick={handleEditSettings}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Information</h3>
                  <p className="text-sm text-blue-800">
                    This rate is applied to all calls made through the system. Users are charged based on the actual duration of their calls.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && activeTab !== 'settings' && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`flex items-center px-3 py-2 rounded-lg ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => handlePageChange(i + 1)}
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === i + 1
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`flex items-center px-3 py-2 rounded-lg ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
