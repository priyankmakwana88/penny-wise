import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function TrendsModal({ isOpen, onClose, userId, householdId }) {
  const [loading, setLoading] = useState(true);
  const [trendScope, setTrendScope] = useState('USER'); // 'USER' or 'HOUSEHOLD'
  const [trendData, setTrendData] = useState([]);
  const [insights, setInsights] = useState({ current: 0, lastMonth: 0, average: 0, diffTotal: 0, diffPercent: 0 });

  useEffect(() => {
    if (isOpen && userId && householdId) {
      fetchTrends();
    }
  }, [isOpen, userId, householdId, trendScope]); // Re-run when scope changes!

  const fetchTrends = async () => {
    setLoading(true);
    let rawData = [];

    // 1. Fetch data based on selected scope
    if (trendScope === 'USER') {
      const { data: splits, error } = await supabase
        .from('expense_splits')
        .select(`amount_owed, expenses!inner (expense_date, description, household_id)`)
        .eq('user_id', userId)
        .eq('expenses.household_id', householdId);

      if (!error && splits) {
        rawData = splits.map(s => ({
          date: s.expenses.expense_date,
          amount: parseFloat(s.amount_owed || 0),
          desc: s.expenses.description
        }));
      }
    } else {
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`amount, expense_date, description`)
        .eq('household_id', householdId);

      if (!error && expenses) {
        rawData = expenses.map(e => ({
          date: e.expense_date,
          amount: parseFloat(e.amount || 0),
          desc: e.description
        }));
      }
    }

    // 2. Process the raw data
    const monthlyTotals = {};
    
    rawData.forEach(item => {
      if (item.desc?.startsWith('Settled Up:')) return;
      
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayMonth = date.toLocaleString('default', { month: 'short', year: 'numeric' });

      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { sortKey: monthKey, name: displayMonth, amount: 0 };
      }
      monthlyTotals[monthKey].amount += item.amount;
    });

    // 3. Sort chronologically
    const sortedMonths = Object.values(monthlyTotals).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    
    // 4. Calculate Insights strictly based on the real calendar month
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    let current = 0;
    const pastMonths = [];

    sortedMonths.forEach(m => {
      if (m.sortKey === currentMonthKey) {
        current = m.amount;
      } else if (m.sortKey < currentMonthKey) {
        pastMonths.push(m);
      }
    });

    let lastMonth = 0;
    let average = 0;

    if (pastMonths.length > 0) {
      lastMonth = pastMonths[pastMonths.length - 1].amount;
      const totalPast = pastMonths.reduce((sum, m) => sum + m.amount, 0);
      average = totalPast / pastMonths.length; 
    }

    const diffTotal = current - average;
    const diffPercent = average > 0 ? ((current - average) / average) * 100 : 0;

    setInsights({ current, lastMonth, average, diffTotal, diffPercent });
    setTrendData(sortedMonths);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Dynamic Title */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            {trendScope === 'USER' ? 'My Spending Trends' : 'Household Spending Trends'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toggle Switch */}
        <div className="flex justify-center bg-gray-50 pb-4 border-b border-gray-100 shrink-0">
          <div className="bg-gray-200 p-1 rounded-lg inline-flex">
            <button 
              onClick={() => setTrendScope('USER')} 
              className={`px-6 py-1.5 text-sm font-semibold rounded-md transition-all ${trendScope === 'USER' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              My Spend
            </button>
            <button 
              onClick={() => setTrendScope('HOUSEHOLD')} 
              className={`px-6 py-1.5 text-sm font-semibold rounded-md transition-all ${trendScope === 'HOUSEHOLD' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Household Spend
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400">Analyzing past expenses...</div>
          ) : trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-100 rounded-xl">
              No data available for this view yet.
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Insight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-500 font-medium mb-1">Past Months Average</p>
                  <p className="text-2xl font-bold text-gray-900">₹{insights.average.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
                
                <div className={`p-4 rounded-xl border ${insights.diffTotal > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                  <p className="text-sm font-medium mb-1 flex items-center gap-2">
                    {insights.diffTotal > 0 ? <TrendingUp className="w-4 h-4 text-red-600" /> : <TrendingDown className="w-4 h-4 text-green-600" />}
                    <span className={insights.diffTotal > 0 ? 'text-red-700' : 'text-green-700'}>Vs. Previous Average</span>
                  </p>
                  <p className={`text-2xl font-bold ${insights.diffTotal > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {insights.diffTotal > 0 ? '+' : ''}{insights.diffPercent.toFixed(1)}%
                  </p>
                  <p className={`text-xs mt-1 ${insights.diffTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Spent ₹{Math.abs(insights.diffTotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })} {insights.diffTotal > 0 ? 'more' : 'less'} than usual.
                  </p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="mt-8 border border-gray-100 rounded-xl p-4 bg-white">
                <h3 className="text-sm font-bold text-gray-800 mb-4">6-Month History</h3>
                <div className="h-[250px] w-full" style={{ minHeight: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData.slice(-6)}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: '#F3F4F6' }}
                        formatter={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {trendData.slice(-6).map((entry, index, arr) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === arr.length - 1 ? '#3B82F6' : '#E5E7EB'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}