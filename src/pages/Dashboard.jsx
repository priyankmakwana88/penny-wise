import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { LogOut, Home, PlusCircle, Settings, Receipt, Activity, ArrowRightLeft, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import HouseholdSetup from '../components/HouseholdSetup';
import CategoryManager from '../components/CategoryManager';
import AddExpenseModal from '../components/AddExpenseModal';
import ExpensePieChart from '../components/ExpensePieChart';
import SettingsModal from '../components/SettingsModal';
import SettlementsModal from '../components/SettlementsModal';
import ExportExcel from '../components/ExportExcel';
import TrendsModal from '../components/TrendsModal';
import BudgetProgress from '../components/BudgetProgress';

const EXPENSES_PER_PAGE = 10;

// Helper function for dynamic category colors
// Helper function for dynamic category colors
const getCategoryStyle = (dbColorChoice, description) => {
  // 1. Check for settlements
  if ((description || '').toLowerCase().startsWith('settled up:')) {
    return { Icon: ArrowRightLeft, bg: 'bg-green-100', text: 'text-green-600', customStyle: null };
  }

  // 2. NEW: Check if it's a Hex Code from the new color picker
  if (dbColorChoice && dbColorChoice.startsWith('#')) {
    return {
      Icon: Receipt,
      bg: '', 
      text: '', 
      customStyle: {
        backgroundColor: `${dbColorChoice}20`, // The '20' adds a beautiful 12% transparency for the background!
        color: dbColorChoice
      }
    };
  }

  // 3. LEGACY: Fallback for old categories created before the color picker
  const colorMap = {
    'blue': { bg: 'bg-blue-100', text: 'text-blue-600' },
    'red': { bg: 'bg-red-100', text: 'text-red-600' },
    'green': { bg: 'bg-green-100', text: 'text-green-600' },
    'purple': { bg: 'bg-purple-100', text: 'text-purple-600' },
    'orange': { bg: 'bg-orange-100', text: 'text-orange-600' },
    'teal': { bg: 'bg-teal-100', text: 'text-teal-600' },
    'pink': { bg: 'bg-pink-100', text: 'text-pink-600' },
    'amber': { bg: 'bg-amber-100', text: 'text-amber-600' },
  };

  const style = colorMap[dbColorChoice] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return { ...style, Icon: Receipt, customStyle: null }; 
};

// Groups expenses by month/year sequentially
const groupExpensesByMonth = (expenses) => {
  const groups = [];
  expenses.forEach(expense => {
    const date = new Date(expense.expense_date);
    const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup.monthYear !== monthYear) {
      groups.push({ monthYear, expenses: [expense] });
    } else {
      lastGroup.expenses.push(expense);
    }
  });
  return groups;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSettlementsModalOpen, setIsSettlementsModalOpen] = useState(false);
  const [isTrendsModalOpen, setIsTrendsModalOpen] = useState(false);

  // Dashboard Data States
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [householdMonthlyTotal, setHouseholdMonthlyTotal] = useState(0);
  const [netBalance, setNetBalance] = useState(0);

  // Filter States
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [selectedPaidByFilters, setSelectedPaidByFilters] = useState([]);
  
  // UI States
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [selectedChartMonth, setSelectedChartMonth] = useState(new Date());

  // Pagination States
  const [hasMoreExpenses, setHasMoreExpenses] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [editingExpense, setEditingExpense] = useState(null);

  const fetchProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userError) throw userError;

      if (userData && userData.household_id) {
        const { data: houseData, error: houseError } = await supabase
          .from('households')
          .select('name')
          .eq('id', userData.household_id)
          .single();
          
        if (!houseError) {
          userData.households = houseData;
        }
      }
      
      setProfile(userData);

    } catch (err) {
      console.error("Dashboard Locked Error:", err);
      alert("Failed to load your profile. Please check the browser console.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!profile?.household_id) return;

    // Fetch household members for the filter buttons
    const { data: memberData } = await supabase
      .from('users')
      .select('id, name')
      .eq('household_id', profile.household_id);
    if (memberData) setHouseholdMembers(memberData);

    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        *,
        categories (name, color),
        users!expenses_paid_by_fkey (name)
      `)
      .eq('household_id', profile.household_id)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, EXPENSES_PER_PAGE - 1);

    if (expenses) {
      setRecentExpenses(expenses);
      setHasMoreExpenses(expenses.length === EXPENSES_PER_PAGE);
    }

    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();

    const { data: userSplits } = await supabase
      .from('expense_splits')
      .select(`amount_owed, expenses!inner(description, expense_date, household_id)`)
      .eq('user_id', user.id)
      .eq('expenses.household_id', profile.household_id)
      .gte('expenses.expense_date', firstDay);

    if (userSplits) {
      const personalTotal = userSplits.reduce((sum, split) => {
        if (split.expenses?.description?.startsWith('Settled Up:')) return sum;
        return sum + parseFloat(split.amount_owed || 0);
      }, 0);
      setMonthlyTotal(personalTotal);
    }

    const { data: householdExpenses } = await supabase
      .from('expenses')
      .select('amount, description')
      .eq('household_id', profile.household_id)
      .gte('expense_date', firstDay);

    if (householdExpenses) {
      const houseTotal = householdExpenses.reduce((sum, exp) => {
        if (exp.description?.startsWith('Settled Up:')) return sum;
        return sum + parseFloat(exp.amount || 0);
      }, 0);
      setHouseholdMonthlyTotal(houseTotal);
    }

    const { data: splits } = await supabase
      .from('expense_splits')
      .select(`
        amount_owed,
        user_id,
        expenses!inner (paid_by, household_id)
      `)
      .eq('expenses.household_id', profile.household_id);

    if (splits) {
      let balance = 0;
      splits.forEach(split => {
        if (split.expenses.paid_by === user.id && split.user_id !== user.id) balance += parseFloat(split.amount_owed);
        else if (split.expenses.paid_by !== user.id && split.user_id === user.id) balance -= parseFloat(split.amount_owed);
      });
      setNetBalance(balance);
    }
    setUpdateTrigger(prev => prev + 1);
  };

  const handleCategoryUpdated = async () => {
    await fetchDashboardData();
    setUpdateTrigger(prev => prev + 1);
  };
  
  const loadMoreExpenses = async () => {
    setIsLoadingMore(true);
    const currentLength = recentExpenses.length;

    const { data: newExpenses } = await supabase
      .from('expenses')
      .select(`
        *,
        categories (name, color),
        users!expenses_paid_by_fkey (name)
      `)
      .eq('household_id', profile.household_id)
      .order('expense_date', { ascending: false })
      .range(currentLength, currentLength + EXPENSES_PER_PAGE - 1);

    if (newExpenses) {
      setRecentExpenses(prev => [...prev, ...newExpenses]);
      setHasMoreExpenses(newExpenses.length === EXPENSES_PER_PAGE);
    }
    setIsLoadingMore(false);
  };

  const toggleMonth = (monthYear) => {
    setCollapsedMonths(prev => ({
      ...prev,
      [monthYear]: !prev[monthYear]
    }));
  };

  const toggleUserFilter = (userId) => {
    setSelectedPaidByFilters(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile?.household_id) {
      fetchDashboardData();
    }
  }, [profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loadingProfile) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading your household...</div>;
  if (!profile || !profile.household_id) return <HouseholdSetup user={user} onComplete={fetchProfile} />;

  const displayedExpenses = selectedPaidByFilters.length > 0
    ? recentExpenses.filter(expense => selectedPaidByFilters.includes(expense.paid_by))
    : recentExpenses;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-gray-900">Penny Wise</span>
            <span className="ml-3 text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
              {profile.households?.name || 'My Household'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-600 font-medium">Hi, {profile.name}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"><LogOut className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Household Overview</h1>
          <div className="flex space-x-3">
            <button onClick={() => setIsSettingsModalOpen(true)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-semibold flex items-center space-x-2 transition-colors shadow-sm">
              <Settings className="w-5 h-5" />
              <span>Settings & Invites</span>
            </button>
            <button 
              onClick={() => {
                setEditingExpense(null);
                setIsExpenseModalOpen(true);
              }} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center space-x-2 transition-colors shadow-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center relative">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">Your Spend This Month</h3>
              <p className="text-3xl font-bold text-blue-600">₹{monthlyTotal.toLocaleString('en-IN')}</p>
            </div>
            
            <button 
              onClick={() => setIsTrendsModalOpen(true)}
              className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors"
              title="Compare Past Months"
            >
              <Activity className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Total Household Spend</span>
              <span className="font-semibold text-gray-900">₹{householdMonthlyTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">Your Balance</h3>
              <p className={`text-3xl font-bold ${netBalance > 0 ? 'text-green-600' : netBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {netBalance > 0 ? `You are owed ₹${Math.abs(netBalance).toLocaleString('en-IN')}` : 
                 netBalance < 0 ? `You owe ₹${Math.abs(netBalance).toLocaleString('en-IN')}` : 
                 'All settled up!'}
              </p>
            </div>
            <button onClick={() => setIsSettlementsModalOpen(true)} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 text-left">
              View Settlements &rarr;
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">Active Budgets</h3>
              <p className="text-3xl font-bold text-blue-600">Ready</p>
            </div>
            <button onClick={() => setIsCategoryModalOpen(true)} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 text-left">
              Manage Categories &rarr;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6 flex flex-col">
            
            {/* NEW: Month Selector for Charts */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900">Monthly Reports</h3>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setSelectedChartMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} 
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-gray-800 min-w-[100px] text-center">
                  {selectedChartMonth.toLocaleString('default', { month: 'short', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => setSelectedChartMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} 
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[350px]">
              <ExpensePieChart householdId={profile.household_id} refreshTrigger={updateTrigger} selectedMonth={selectedChartMonth} />
            </div>

            <BudgetProgress householdId={profile.household_id} refreshTrigger={updateTrigger} selectedMonth={selectedChartMonth} />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
            <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
              <h3 className="font-bold text-gray-900 text-lg">Recent Expenses</h3>
              <ExportExcel 
                householdId={profile.household_id} 
                householdName={profile.households?.name || 'Household'} 
                currentUserId={user.id} 
                currentUserName={profile.name}
              />
            </div>

            {householdMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                <button
                  onClick={() => setSelectedPaidByFilters([])}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    selectedPaidByFilters.length === 0 
                      ? 'bg-gray-800 text-white border-gray-800' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  All Expenses
                </button>
                {householdMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => toggleUserFilter(member.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                      selectedPaidByFilters.includes(member.id)
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Paid by {member.name}
                  </button>
                ))}
              </div>
            )}
            
            {recentExpenses.length === 0 ? (
              <div className="flex items-center justify-center flex-1 text-gray-400">
                <p>No expenses logged yet.</p>
              </div>
            ) : displayedExpenses.length === 0 ? (
               <div className="flex items-center justify-center flex-1 text-gray-400">
                <p>No expenses match this filter.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-6">
                  {groupExpensesByMonth(displayedExpenses).map((group, groupIndex) => {
                    const isCollapsed = collapsedMonths[group.monthYear];

                    return (
                      <div key={groupIndex} className="relative">
                        <div 
                          className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 mb-2 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => toggleMonth(group.monthYear)}
                        >
                          <h4 className="text-xs font-bold text-gray-500 group-hover:text-blue-600 uppercase tracking-wider transition-colors">
                            {group.monthYear}
                          </h4>
                          <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                            )}
                          </button>
                        </div>

                        {!isCollapsed && (
                          <ul className="space-y-2 mb-4">
                            {group.expenses.map((expense, index) => {
                              const { Icon, bg, text, customStyle } = getCategoryStyle(expense.categories?.color, expense.description);

                              return (
                                <li 
                                  key={`${expense.id}-${index}`} 
                                  onClick={() => {
                                    setEditingExpense(expense);
                                    setIsExpenseModalOpen(true);
                                  }}
                                  className="cursor-pointer flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                >
                                  <div className="flex items-center space-x-4">
                                  <div className={`${bg} p-2 rounded-lg ${text} shrink-0`} style={customStyle}>
                                      <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-900 truncate">{expense.description}</p>
                                      <p className="text-xs text-gray-500 truncate">
                                        {expense.description?.startsWith('Settled Up:') 
                                          ? 'Transfer' 
                                          : (expense.categories?.name || 'Untracked')} • Paid by {expense.users?.name === profile.name ? 'You' : expense.users?.name}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 ml-4">
                                    <p className="font-bold text-gray-900">₹{parseFloat(expense.amount).toLocaleString('en-IN')}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {hasMoreExpenses && (
                  <button
                    onClick={loadMoreExpenses}
                    disabled={isLoadingMore}
                    className="w-full mt-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <CategoryManager 
          isOpen={isCategoryModalOpen} 
          onClose={() => setIsCategoryModalOpen(false)} 
          householdId={profile.household_id} 
          onCategoryUpdated={handleCategoryUpdated} 
        />
        <AddExpenseModal 
          isOpen={isExpenseModalOpen} 
          onClose={() => {
              setIsExpenseModalOpen(false);
              setEditingExpense(null);
          }} 
          householdId={profile.household_id} 
          currentUser={user} 
          onSave={fetchDashboardData} 
          existingExpense={editingExpense} 
        />
        <TrendsModal 
          isOpen={isTrendsModalOpen} 
          onClose={() => setIsTrendsModalOpen(false)} 
          userId={user.id} 
          householdId={profile.household_id} 
        />
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} householdId={profile.household_id} householdName={profile.households?.name} />
        <SettlementsModal isOpen={isSettlementsModalOpen} onClose={() => setIsSettlementsModalOpen(false)} householdId={profile.household_id} onSettlementComplete={fetchDashboardData} />
      </main>
    </div>
  );
}