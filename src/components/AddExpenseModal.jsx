import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Receipt, SplitSquareHorizontal } from 'lucide-react';

export default function AddExpenseModal({ isOpen, onClose, householdId, currentUser, onSave, existingExpense }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data lists
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const today = new Date().toISOString().split('T')[0];
  
  // Split State
  const [splitType, setSplitType] = useState('EQUAL'); 
  const [customSplits, setCustomSplits] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (existingExpense) {
         // Populate form with existing data
         setDescription(existingExpense.description);
         setAmount(existingExpense.amount);
         setCategoryId(existingExpense.category_id);
         setDate(existingExpense.expense_date);
         
         // 1. SET THE REAL SPLIT TYPE
         setSplitType(existingExpense.split_type || 'EQUAL'); 
      } else {
         // Clear it if adding a new one
         setDescription('');
         setAmount('');
         setCategoryId('');
         setDate(today);
         setSplitType('EQUAL');
         setCustomSplits({});
      }
      setError(null);
      fetchFormData();
    }
  }, [isOpen, existingExpense, today]);

  const fetchFormData = async () => {
    // Fetch active categories
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', householdId);
    if (catData) setCategories(catData);

    // Fetch household members
    const { data: memberData } = await supabase
      .from('users')
      .select('id, name')
      .eq('household_id', householdId);
    if (memberData) setMembers(memberData);

    // 2. NEW: FETCH CUSTOM SPLITS IF APPLICABLE
    if (existingExpense && existingExpense.split_type === 'CUSTOM') {
      const { data: splitData } = await supabase
        .from('expense_splits')
        .select('user_id, amount_owed')
        .eq('expense_id', existingExpense.id);

      if (splitData) {
        // Convert the database array back into our state object: { user_id: amount }
        const loadedSplits = {};
        splitData.forEach(split => {
          loadedSplits[split.user_id] = parseFloat(split.amount_owed);
        });
        setCustomSplits(loadedSplits);
      }
    } else {
      setCustomSplits({});
    }
  };

  const handleCustomSplitChange = (userId, value) => {
    setCustomSplits(prev => ({
      ...prev,
      [userId]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const totalAmount = parseFloat(amount);
    if (!totalAmount || totalAmount <= 0) {
      setError("Please enter a valid amount.");
      setLoading(false);
      return;
    }

    if (!categoryId) {
      setError("Please select a category.");
      setLoading(false);
      return;
    }
    if (date > today) {
      setError("Expense date cannot be in the future.");
      setLoading(false);
      return;
    }
    if (!members.length) {
      setError("No household members found to split this expense with.");
      setLoading(false);
      return;
    }

    // Calculate Exact Splits based on type
    let finalSplits = [];
    if (splitType === 'EQUAL') {
      const splitAmount = totalAmount / members.length;
      finalSplits = members.map(m => ({
        user_id: m.id,
        amount_owed: splitAmount
      }));
    } else if (splitType === 'CUSTOM') {
      // Validate Custom Split Math
      const customTotal = Object.values(customSplits).reduce((sum, val) => sum + val, 0);
      if (Math.abs(customTotal - totalAmount) > 0.01) { 
        setError(`Custom splits must equal exactly ₹${totalAmount}. Currently: ₹${customTotal}`);
        setLoading(false);
        return;
      }
      finalSplits = members.map(m => ({
        user_id: m.id,
        amount_owed: customSplits[m.id] || 0
      }));
    }

    try {
      let expenseIdToUse;

      if (existingExpense) {
        // --- WE ARE UPDATING ---
        const { error: expenseError } = await supabase
          .from('expenses')
          .update({
            category_id: categoryId,
            amount: totalAmount,
            description: description,
            expense_date: date,
            split_type: splitType
          })
          .eq('id', existingExpense.id);

        if (expenseError) throw expenseError;
        expenseIdToUse = existingExpense.id;

        // Delete all old split logic so we can insert fresh ones
        await supabase.from('expense_splits').delete().eq('expense_id', expenseIdToUse);

      } else {
        // --- WE ARE INSERTING NEW ---
        const { data: expenseRecord, error: expenseError } = await supabase
          .from('expenses')
          .insert([{
            household_id: householdId,
            category_id: categoryId,
            paid_by: currentUser.id, 
            amount: totalAmount,
            description: description,
            expense_date: date,
            split_type: splitType
          }])
          .select()
          .single();

        if (expenseError) throw expenseError;
        expenseIdToUse = expenseRecord.id;
      }

      // Insert the Individual Owed Splits (Runs for BOTH Edit and Create)
      const splitsToInsert = finalSplits.map(split => ({
        expense_id: expenseIdToUse,
        user_id: split.user_id,
        amount_owed: split.amount_owed
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) throw splitsError;

      // Success!
      onSave(); 
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-blue-600" />
            {existingExpense ? "Edit Expense" : "Add New Expense"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

          <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Amount & Description */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text" required placeholder="e.g. Weekly Groceries"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={description} onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total (₹)</label>
                <input
                  type="number" required min="1" step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Category & Date */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="" disabled>Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date" required max={today}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={date} onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Split Engine Section */}
            <div className="pt-4 border-t border-gray-100 mt-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center text-sm font-bold text-gray-800">
                  <SplitSquareHorizontal className="w-4 h-4 mr-2 text-blue-600" />
                  How is this split?
                </label>
                <div className="bg-gray-100 p-1 rounded-lg flex">
                  <button type="button" onClick={() => setSplitType('EQUAL')} className={`px-3 py-1 text-xs font-semibold rounded-md ${splitType === 'EQUAL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Equal</button>
                  <button type="button" onClick={() => setSplitType('CUSTOM')} className={`px-3 py-1 text-xs font-semibold rounded-md ${splitType === 'CUSTOM' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Custom</button>
                </div>
              </div>

              {/* Dynamic Split UI */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                {splitType === 'EQUAL' ? (
                  <p className="text-sm text-center text-gray-600">
                    {!amount
                      ? 'Enter an amount to see the equal split.'
                      : !members.length
                        ? 'No members found to split this with.'
                        : `Everyone owes exactly ₹${(amount / members.length).toFixed(2)}`}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {members.map(member => (
                      <div key={member.id} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{member.name}</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1.5 text-gray-400 text-sm">₹</span>
                          <input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            className="w-24 pl-6 pr-2 py-1 border border-gray-300 rounded focus:ring-blue-500 outline-none text-right text-sm font-medium"
                            value={customSplits[member.id] || ''}
                            onChange={(e) => handleCustomSplitChange(member.id, e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Cancel</button>
          <button type="submit" form="expense-form" disabled={loading} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>

      </div>
    </div>
  );
}