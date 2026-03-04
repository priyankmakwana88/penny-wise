import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Copy, Check, Users, Settings as SettingsIcon } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, householdId, householdName }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && householdId) {
      fetchMembers();
    }
  }, [isOpen, householdId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('household_id', householdId)
      .order('name');

    if (!error && data) {
      setMembers(data);
    }
    setLoading(false);
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(householdId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset the checkmark after 2 seconds
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2 text-blue-600" />
            Household Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* Invite Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Invite Code</h3>
            <p className="text-sm text-gray-600 mb-3">
              Share this code with your family or roommates so they can join <strong>{householdName}</strong>.
            </p>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1">
              <code className="flex-1 px-3 text-sm font-mono text-gray-800 overflow-x-auto truncate">
                {householdId}
              </code>
              <button
                onClick={copyInviteCode}
                className={`flex items-center space-x-1 px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
                  copied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Members Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Active Members
            </h3>
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-4">Loading members...</p>
            ) : (
              <ul className="space-y-3">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mr-3 shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-semibold text-gray-900 truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}