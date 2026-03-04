import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Home, Users, ArrowRight } from 'lucide-react';

export default function HouseholdSetup({ user, onComplete }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form inputs
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create the new household in the database
      const { data: newHouse, error: houseError } = await supabase
        .from('households')
        .insert([{ name: houseName }])
        .select()
        .single();

      if (houseError) throw houseError;

      // 2. Link the current user to this new household
      const { error: userError } = await supabase
        .from('users')
        .update({ household_id: newHouse.id })
        .eq('id', user.id);

      if (userError) throw userError;

      // 3. Force the browser to reload so it fetches your new household status!
      window.location.reload();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Verify the household exists
      const { data: existingHouse, error: houseError } = await supabase
        .from('households')
        .select('id')
        .eq('id', inviteCode)
        .single();

      if (houseError || !existingHouse) throw new Error("Invalid Invite Code. Please check and try again.");

      // 2. Link the current user to this existing household
      const { error: userError } = await supabase
        .from('users')
        .update({ household_id: existingHouse.id })
        .eq('id', user.id);

      if (userError) throw userError;

      // 3. Force the browser to reload so it fetches your new household status!
      window.location.reload();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Penny Wise!</h1>
          <p className="text-gray-500">Let's get your household set up so you can start tracking expenses.</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab('create'); setError(null); }}
          >
            Create New
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'join' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab('join'); setError(null); }}
          >
            Join Existing
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Create Flow */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Household Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Home className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="e.g., The Umrania Residence"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Creating...' : 'Create Household'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Join Flow */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Paste your code here..."
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Ask the person who created the household to share their Invite Code with you.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Joining...' : 'Join Household'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}