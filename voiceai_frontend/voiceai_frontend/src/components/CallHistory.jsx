import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Phone,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const CallHistory = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCall, setExpandedCall] = useState(null);

  const fetchCallHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/call-history', {
        params: { limit: 50, offset: 0 },
      });
      setCalls(response.data.calls);
    } catch (err) {
      setError('Failed to load call history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const toggleExpand = (callId) => {
    setExpandedCall(expandedCall === callId ? null : callId);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading call history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="glass-effect rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Call History</h1>
            <p className="text-gray-600">
              View all your AI-powered phone calls and transcripts
            </p>
          </div>
          <button
            onClick={fetchCallHistory}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Call List */}
        {calls.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No calls yet
            </h3>
            <p className="text-gray-500">
              Make your first call to see it appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call) => (
              <div
                key={call.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Call Summary */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(call.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Phone className="w-5 h-5 text-primary-600" />
                          <span className="font-semibold text-lg text-gray-800">
                            {call.phone_number}
                          </span>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            call.status
                          )}`}
                        >
                          {call.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {call.lead_status && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                              call.lead_status === 'hot'
                                ? 'bg-orange-100 text-orange-800 border-orange-200'
                                : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                            }`}
                          >
                            {call.lead_status === 'hot' ? '🔥 HOT LEAD' : '❄️ COLD LEAD'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center text-gray-600">
                          <FileText className="w-4 h-4 mr-2" />
                          <span>{call.knowledge_base_name}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span>{formatDate(call.started_at)}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-2" />
                          <span>{formatDuration(call.duration)}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          <span>
                            {call.transcript?.length || 0} messages
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      {expandedCall === call.id ? (
                        <ChevronUp className="w-6 h-6 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCall === call.id && (
                  <div className="border-t border-gray-200 bg-gray-50 p-5">
                    {/* Summary */}
                    {call.summary && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Call Summary
                        </h4>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-700">{call.summary}</p>
                        </div>
                      </div>
                    )}

                    {/* Transcript */}
                    {call.transcript && call.transcript.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Conversation Transcript
                        </h4>
                        <div className="bg-white rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                          <div className="p-4 space-y-3">
                            {call.transcript.map((message, index) => (
                              <div
                                key={index}
                                className={`flex ${
                                  message.role === 'user'
                                    ? 'justify-end'
                                    : 'justify-start'
                                }`}
                              >
                                <div
                                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                                    message.role === 'user'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-800'
                                  }`}
                                >
                                  <div className="text-xs font-semibold mb-1 opacity-75">
                                    {message.role === 'user' ? 'User' : 'AI'}
                                  </div>
                                  <p className="text-sm">{message.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Call Details */}
                    <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-semibold">Call SID:</span>{' '}
                        {call.call_sid}
                      </div>
                      <div>
                        <span className="font-semibold">KB ID:</span>{' '}
                        {call.knowledge_base_id}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallHistory;
