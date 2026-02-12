import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Megaphone, Upload, FileText, Loader2, CheckCircle, AlertCircle, 
  Phone, Plus, RefreshCw, Trash2, Eye, Download, Wallet, Calendar, Clock 
} from 'lucide-react';

// Voice options per TTS engine (same as CallInterface)
const TTS_VOICES = {
  cartesia: {
    en: [{ id: '', label: 'Default (English)' }],
    hi: [{ id: '', label: 'Default (Hindi)' }],
  },
  sarvam: {
    hi: [
      { id: 'anushka', label: 'Anushka (Female)' },
      { id: 'manisha', label: 'Manisha (Female)' },
      { id: 'vidya', label: 'Vidya (Female)' },
      { id: 'arya', label: 'Arya (Female)' },
      { id: 'abhilash', label: 'Abhilash (Male)' },
      { id: 'karun', label: 'Karun (Male)' },
      { id: 'hitesh', label: 'Hitesh (Male)' },
    ],
    en: [
      { id: 'anushka', label: 'Anushka (Female)' },
      { id: 'manisha', label: 'Manisha (Female)' },
      { id: 'vidya', label: 'Vidya (Female)' },
      { id: 'arya', label: 'Arya (Female)' },
      { id: 'abhilash', label: 'Abhilash (Male)' },
      { id: 'karun', label: 'Karun (Male)' },
      { id: 'hitesh', label: 'Hitesh (Male)' },
    ],
  },
};

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Create campaign form state
  const [campaignName, setCampaignName] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [kbFile, setKbFile] = useState(null);
  const [kbId, setKbId] = useState('');
  const [kbName, setKbName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! This is आरती from Akashvanni calling you.');
  const [language, setLanguage] = useState('en');
  const [chunkSize, setChunkSize] = useState(10);
  const [inputMethod, setInputMethod] = useState('text'); // 'text' or 'file'
  const [ttsEngine, setTtsEngine] = useState('cartesia');
  const [ttsVoice, setTtsVoice] = useState('');
  const [uploadingKb, setUploadingKb] = useState(false);
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  const fileInputRef = useRef(null);
  const kbFileInputRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    // Initial fetch and start polling
    fetchCampaigns();
    loadWalletBalance();
    startPolling();
    
    return () => {
      // Cleanup on unmount
      stopPolling();
    };
  }, []);

  const loadWalletBalance = async () => {
    try {
      const response = await axios.get('/api/wallet/balance');
      setWalletBalance(response.data.balance);
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
    }
  };

  const startPolling = () => {
    // Clear any existing interval first
    stopPolling();
    // Poll for campaign updates every 5 seconds
    pollingIntervalRef.current = setInterval(fetchCampaigns, 5000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('✓ Stopped polling - all campaigns completed');
    }
  };

  const hasActiveCampaigns = (campaignsList) => {
    // Check if there are any campaigns that are not completed or failed
    return campaignsList.some(campaign => 
      campaign.status === 'pending' || 
      campaign.status === 'processing'
    );
  };

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get('/api/campaigns', {
        params: { limit: 50, offset: 0 }
      });
      setCampaigns(response.data.campaigns);
      
      // Stop polling if all campaigns are completed or failed
      if (response.data.campaigns.length > 0 && !hasActiveCampaigns(response.data.campaigns)) {
        stopPolling();
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const handleDownloadCampaign = async (campaignId, campaignName) => {
    try {
      const response = await axios.get(`/api/campaigns/${campaignId}/download`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign_${campaignName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download campaign data');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!(file.name.endsWith('.txt') || file.name.endsWith('.csv'))) {
        setError('Please select a .txt or .csv file');
        return;
      }
      setUploadedFile(file);
      setError(null);
    }
  };

  const handleKbFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.txt')) {
        setError('Please select a .txt file for knowledge base');
        return;
      }
      setKbFile(file);
      setError(null);
    }
  };

  const handleUploadKnowledgeBase = async () => {
    if (!kbFile) {
      setError('Please select a knowledge base file first');
      return;
    }

    setUploadingKb(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', kbFile);

      const response = await axios.post('/api/upload-knowledge-base', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setKbId(response.data.kb_id);
      setKbName(response.data.kb_id);
      setSuccess(`Knowledge base "${response.data.kb_id}" uploaded successfully!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload knowledge base');
    } finally {
      setUploadingKb(false);
    }
  };

  const handleCreateCampaign = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate scheduling
      let scheduledDateTime = null;
      if (isScheduled) {
        if (!scheduledDate || !scheduledTime) {
          setError('Please select both date and time for scheduled campaign');
          return;
        }
        
        // Combine date and time into ISO string
        scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`;
        
        // Validate future time
        const scheduledTimestamp = new Date(scheduledDateTime).getTime();
        const now = new Date().getTime();
        
        if (scheduledTimestamp <= now) {
          setError('Scheduled time must be in the future');
          return;
        }
      }
      
      let response;

      if (inputMethod === 'file' && uploadedFile) {
        // Upload file with phone numbers
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('name', campaignName);
        formData.append('kb_id', kbId);
        formData.append('kb_name', kbName || kbId);
        formData.append('welcome_message', welcomeMessage);
        formData.append('language', language);
        formData.append('tts_engine', ttsEngine);
        formData.append('tts_voice', ttsVoice);
        formData.append('chunk_size', chunkSize);
        formData.append('retry_failed', 'true');
        formData.append('is_scheduled', isScheduled.toString());
        if (scheduledDateTime) {
          formData.append('scheduled_time', scheduledDateTime);
        }

        response = await axios.post('/api/campaigns/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Use comma-separated or newline-separated numbers
        if (!phoneNumbers.trim()) {
          setError('Please enter phone numbers');
          return;
        }

        const params = {
          name: campaignName,
          phone_numbers: phoneNumbers,
          kb_id: kbId,
          kb_name: kbName || kbId,
          welcome_message: welcomeMessage,
          language: language,
          tts_engine: ttsEngine,
          tts_voice: ttsVoice,
          chunk_size: chunkSize,
          retry_failed: true,
          is_scheduled: isScheduled
        };
        
        if (scheduledDateTime) {
          params.scheduled_time = scheduledDateTime;
        }

        response = await axios.post('/api/campaigns', null, { params });
      }

      setSuccess(`Campaign "${response.data.campaign_name || campaignName}" created successfully!`);
      
      // Reset form
      setCampaignName('');
      setPhoneNumbers('');
      setUploadedFile(null);
      setKbFile(null);
      setKbId('');
      setKbName('');
      setWelcomeMessage('Hello! This is आरती from Akashvanni calling you.');
      setLanguage('en');
      setTtsEngine('cartesia');
      setTtsVoice('');
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (kbFileInputRef.current) {
        kbFileInputRef.current.value = '';
      }

      // Close modal and refresh campaigns
      setTimeout(() => {
        setShowCreateModal(false);
        fetchCampaigns();
        // Restart polling since we have a new active campaign
        startPolling();
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async (campaignId) => {
    try {
      const response = await axios.post(`/api/campaigns/${campaignId}/retry`);
      setSuccess(response.data.message);
      fetchCampaigns();
      // Restart polling since we created a retry campaign
      startPolling();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to retry campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await axios.delete(`/api/campaigns/${campaignId}`);
      setSuccess('Campaign deleted successfully');
      fetchCampaigns();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete campaign');
    }
  };

  const handleViewDetails = async (campaignId) => {
    try {
      const response = await axios.get(`/api/campaigns/${campaignId}`);
      setSelectedCampaign(response.data);
    } catch (err) {
      setError('Failed to load campaign details');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const calculateSuccessRate = (campaign) => {
    const { successful, total } = campaign.progress;
    if (total === 0) return 0;
    return ((successful / total) * 100).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Low Balance Warning */}
      {walletBalance < 10 && (
        <div className="glass-effect rounded-xl shadow-lg p-4 mb-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Wallet className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800">Low Wallet Balance</h3>
              <p className="text-sm text-red-700">
                Your current balance is ₹{walletBalance.toFixed(2)}. 
                You need at least ₹10 to create campaigns. Please recharge your wallet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-600 rounded-lg">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bulk Calling Campaigns</h1>
            <p className="text-sm text-gray-600">Manage campaigns for calling multiple numbers</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Campaign
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}

      {/* Campaigns List */}
      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <div className="glass-effect rounded-lg p-12 text-center">
            <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-4">Create your first bulk calling campaign</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-semibold"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign._id} className="glass-effect rounded-lg p-6 hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{campaign.name}</h3>
                  <p className="text-sm text-gray-600">
                    KB: {campaign.knowledge_base_name} • Language: {campaign.language === 'hi' ? '🇮🇳 Hindi' : '🇬🇧 English'}
                  </p>
                  {campaign.status === 'scheduled' && campaign.scheduled_time && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-1 rounded-lg inline-flex">
                      <Calendar className="w-4 h-4" />
                      <span>Scheduled: {new Date(campaign.scheduled_time).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(campaign.status)}`}>
                  {campaign.status.toUpperCase()}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-semibold text-gray-800">
                    {campaign.progress.completed} / {campaign.progress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${(campaign.progress.completed / campaign.progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{campaign.progress.total}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{campaign.progress.successful}</div>
                  <div className="text-xs text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{campaign.progress.failed}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{campaign.progress.in_progress}</div>
                  <div className="text-xs text-gray-600">In Progress</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{campaign.progress.hot_leads || 0}</div>
                  <div className="text-xs text-gray-600">🔥 Hot Leads</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-600">{campaign.progress.cold_leads || 0}</div>
                  <div className="text-xs text-gray-600">❄️ Cold Leads</div>
                </div>
              </div>

              {/* Success Rate */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <span className="text-lg font-bold text-primary-600">{calculateSuccessRate(campaign)}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewDetails(campaign._id)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
                {campaign.progress.failed > 0 && (
                  <button
                    onClick={() => handleRetryFailed(campaign._id)}
                    className="flex-1 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-all font-semibold flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Failed
                  </button>
                )}
                <button
                  onClick={() => handleDeleteCampaign(campaign._id)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-semibold"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Timestamp */}
              <div className="mt-3 text-xs text-gray-500">
                Created: {new Date(campaign.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Create New Campaign</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Campaign Name */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., January Outreach Campaign"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Input Method Toggle */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Numbers Input Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInputMethod('text')}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      inputMethod === 'text'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    ✍️ Type Numbers
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMethod('file')}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      inputMethod === 'file'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    📁 Upload File
                  </button>
                </div>
              </div>

              {/* Phone Numbers Input */}
              {inputMethod === 'text' ? (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Numbers
                  </label>
                  <textarea
                    value={phoneNumbers}
                    onChange={(e) => setPhoneNumbers(e.target.value)}
                    placeholder="Enter comma-separated or one per line&#10;e.g., +1234567890, +9876543210&#10;or&#10;+1234567890&#10;+9876543210"
                    rows="6"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter numbers separated by commas or one per line (with country code)
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Upload File (.txt or .csv)
                  </label>
                  <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-all bg-gray-50 hover:bg-gray-100">
                    <Upload className="w-6 h-6 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {uploadedFile ? uploadedFile.name : 'Choose a file with phone numbers...'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    File should contain one phone number per line or comma-separated
                  </p>
                </div>
              )}

              {/* Knowledge Base File Upload */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Knowledge Base File (.txt)
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-all bg-gray-50 hover:bg-gray-100">
                      <Upload className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        {kbFile ? kbFile.name : 'Choose knowledge base file...'}
                      </span>
                      <input
                        ref={kbFileInputRef}
                        type="file"
                        accept=".txt"
                        onChange={handleKbFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleUploadKnowledgeBase}
                    disabled={!kbFile || uploadingKb}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-semibold flex items-center gap-2"
                  >
                    {uploadingKb ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
                {kbId && (
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Knowledge base ready: {kbId}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Upload a .txt file containing your knowledge base information
                </p>
              </div>

              {/* Language */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Language
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      setWelcomeMessage('Hello! This is आरती from Akashvanni calling you.');
                    }}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      language === 'en'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('hi');
                      setWelcomeMessage('नमस्ते! मैं आकाशवाणी से आरती हूं।');
                    }}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      language === 'hi'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🇮🇳 हिंदी (Hindi)
                  </button>
                </div>
              </div>

              {/* TTS Engine */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  TTS Engine
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setTtsEngine('cartesia'); setTtsVoice(''); }}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      ttsEngine === 'cartesia'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Cartesia (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTtsEngine('sarvam'); setTtsVoice('anushka'); }}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      ttsEngine === 'sarvam'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Sarvam AI
                  </button>
                </div>
              </div>

              {/* TTS Voice */}
              {ttsEngine === 'sarvam' && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Voice
                  </label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {(TTS_VOICES.sarvam[language] || TTS_VOICES.sarvam.en).map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Welcome Message */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows="3"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>

              {/* Scheduling Options */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Campaign Execution
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsScheduled(false)}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all flex items-center justify-center gap-2 ${
                      !isScheduled
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                    Run Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduled(true)}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all flex items-center justify-center gap-2 ${
                      isScheduled
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                    Schedule for Later
                  </button>
                </div>
              </div>

              {/* Schedule DateTime (shown only when scheduled) */}
              {isScheduled && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <label className="text-sm font-semibold text-purple-900">
                      Select Date and Time
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-purple-700">
                    Campaign will start automatically at the scheduled time
                  </p>
                </div>
              )}

              {/* Chunk Size */}
              {/* <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Concurrent Calls (Chunk Size)
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value) || 10)}
                  min="1"
                  max="50"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Number of calls to process simultaneously (recommended: 5-15)
                </p>
              </div> */}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCampaign}
                  disabled={loading || (!phoneNumbers.trim() && !uploadedFile) || !campaignName || !kbId}
                  className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Phone className="w-5 h-5" />
                      Create Campaign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{selectedCampaign.name}</h2>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Campaign Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${getStatusColor(selectedCampaign.status)}`}>
                    {selectedCampaign.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Language:</span>
                  <span className="ml-2 font-semibold">
                    {selectedCampaign.language === 'hi' ? '🇮🇳 Hindi' : '🇬🇧 English'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Knowledge Base:</span>
                  <span className="ml-2 font-semibold">{selectedCampaign.knowledge_base_name}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Numbers:</span>
                  <span className="ml-2 font-semibold">{selectedCampaign.total_numbers}</span>
                </div>
              </div>

              {/* Call Results */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between">
                  <span>Call Details</span>
                  <button
                    onClick={() => handleDownloadCampaign(selectedCampaign._id, selectedCampaign.name)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
                  >
                    <Download size={16} />
                    Download CSV
                  </button>
                </h3>
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedCampaign.call_details && selectedCampaign.call_details.length > 0 ? (
                        selectedCampaign.call_details.map((call, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono">{call.phone_number}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                call.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                call.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                call.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {call.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {call.lead_status ? (
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  call.lead_status === 'hot' 
                                    ? 'bg-orange-100 text-orange-800' 
                                    : 'bg-cyan-100 text-cyan-800'
                                }`}>
                                  {call.lead_status === 'hot' ? '🔥 HOT' : '❄️ COLD'}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {call.duration ? `${Math.round(call.duration)}s` : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                              {call.summary || 'No summary available'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {call.started_at ? new Date(call.started_at).toLocaleString() : 'N/A'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                            No call details available yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={() => setSelectedCampaign(null)}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
