import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Phone, Upload, FileText, Loader2, CheckCircle, AlertCircle, PhoneCall } from 'lucide-react';

// Voice options per TTS engine
const TTS_VOICES = {
  cartesia: {
    en: [
      { id: '', label: 'Default (English)' },
    ],
    hi: [
      { id: '', label: 'Default (Hindi)' },
    ],
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

const CallInterface = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [kbId, setKbId] = useState('');
  const [language, setLanguage] = useState('en');
  const [ttsEngine, setTtsEngine] = useState('cartesia');
  const [ttsVoice, setTtsVoice] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! This is आरती from Akashvanni calling you.');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Get available voices for current engine + language
  const getAvailableVoices = () => {
    return TTS_VOICES[ttsEngine]?.[language] || [];
  };

  // Update welcome message when language changes
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setTtsVoice('');
    if (lang === 'hi') {
      setWelcomeMessage('नमस्ते! मैं Akashvanni से आरती हूं।');
    } else {
      setWelcomeMessage('Hello! This is आरती from Akashvanni calling you.');
    }
  };

  const handleEngineChange = (engine) => {
    setTtsEngine(engine);
    setTtsVoice('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.txt')) {
        setError('Please select a .txt file');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadKnowledgeBase = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post('/api/upload-knowledge-base', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setKbId(response.data.kb_id);
      setStatus({
        type: 'success',
        message: `Knowledge base "${response.data.kb_id}" uploaded successfully!`,
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload knowledge base');
    } finally {
      setUploading(false);
    }
  };

  const handleMakeCall = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }

    if (!kbId) {
      setError('Please upload a knowledge base first');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await axios.post('/api/call', null, {
        params: {
          to_number: phoneNumber,
          kb_id: kbId,
          kb_name: selectedFile?.name.replace('.txt', '') || kbId,
          welcome_message: welcomeMessage,
          language: language,
          tts_engine: ttsEngine,
          tts_voice: ttsVoice,
        },
      });

      setStatus({
        type: 'success',
        message: `Call initiated successfully! Call SID: ${response.data.call_sid}`,
        callSid: response.data.call_sid,
      });

      // Reset form
      setTimeout(() => {
        setPhoneNumber('');
        setSelectedFile(null);
        setKbId('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to initiate call');
    } finally {
      setLoading(false);
    }
  };

  const availableVoices = getAvailableVoices();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-effect rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <PhoneCall className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Make AI Phone Call
          </h1>
          <p className="text-gray-600">
            Upload your knowledge base and place a call with AI assistance
          </p>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Language
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                language === 'en'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('hi')}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                language === 'hi'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>

        {/* TTS Engine Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Voice Engine
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleEngineChange('cartesia')}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                ttsEngine === 'cartesia'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="text-sm font-bold">Cartesia</div>
              <div className="text-xs text-gray-500 mt-1">Ultra-fast, global</div>
            </button>
            <button
              type="button"
              onClick={() => handleEngineChange('sarvam')}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                ttsEngine === 'sarvam'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="text-sm font-bold">Sarvam</div>
              <div className="text-xs text-gray-500 mt-1">Indian languages, 25+ voices</div>
            </button>
          </div>
        </div>

        {/* Voice Selection */}
        {availableVoices.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Voice
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
            >
              {availableVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Welcome Message Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Welcome Message
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Enter the greeting message for the call"
            rows="3"
            className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"
          />
          <p className="mt-1 text-sm text-gray-500">
            This message will be spoken when the call connects
          </p>
        </div>

        {/* Phone Number Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number (with country code)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Example: +1234567890 (include country code)
          </p>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Knowledge Base File (.txt)
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-all bg-gray-50 hover:bg-gray-100">
                <Upload className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : 'Choose a file...'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <button
              onClick={handleUploadKnowledgeBase}
              disabled={!selectedFile || uploading}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-semibold flex items-center gap-2"
            >
              {uploading ? (
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
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {status && status.type === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-700">
              <p className="font-semibold">{status.message}</p>
              {status.callSid && (
                <p className="text-xs mt-1 text-green-600">
                  Track this call in the History tab
                </p>
              )}
            </div>
          </div>
        )}

        {/* Make Call Button */}
        <button
          onClick={handleMakeCall}
          disabled={loading || !phoneNumber || !kbId}
          className="w-full py-4 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:from-primary-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Initiating Call...
            </>
          ) : (
            <>
              <Phone className="w-6 h-6" />
              Make Call
            </>
          )}
        </button>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            How it works:
          </h3>
          <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
            <li>Upload a .txt file containing your knowledge base</li>
            <li>Choose your voice engine and voice</li>
            <li>Enter the phone number with country code (e.g., +1234567890)</li>
            <li>Click "Make Call" to initiate the AI-powered call</li>
            <li>Check the History tab to view call transcripts and summaries</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
