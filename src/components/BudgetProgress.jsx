import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function BudgetProgress({ householdId, refreshTrigger }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (householdId) {
      fetchBudgetHealth();
    }
  }, [householdId, refreshTrigger]);

  const fetchBudgetHealth = async () => {
    setLoading(true);
    
    // 1. Fetch categories that actually have a budget set (> 0)
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, monthly_budget, color')
      .eq('household_id', householdId)
      .gt('monthly_budget', 0); // Ignore categories with 0 budget

    if (!categories || categories.length === 0) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    // 2. Fetch all household expenses for the current month
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category_id, description')
      .eq('household_id', householdId)
      .gte('expense_date', firstDay);

    // 3. Map the spend to the categories
    const spendMap = {};
    if (expenses) {
      expenses.forEach(exp => {
        if (exp.description?.startsWith('Settled Up:')) return;
        spendMap[exp.category_id] = (spendMap[exp.category_id] || 0) + parseFloat(exp.amount || 0);
      });
    }

    // 4. Calculate Health Logic
    const progressData = categories.map(cat => {
      const spent = spendMap[cat.id] || 0;
      const rawPercentage = (spent / cat.monthly_budget) * 100;
      
      // Cap the visual bar at 100% so it doesn't break the UI
      const visualPercentage = Math.min(rawPercentage, 100); 
      
      let status = 'good';
      let colorClass = 'bg-green-500';
      let bgClass = 'bg-green-50';
      let textClass = 'text-green-700';
      let Icon = CheckCircle2;

      if (rawPercentage >= 100) {
        status = 'over';
        colorClass = 'bg-red-500';
        bgClass = 'bg-red-50';
        textClass = 'text-red-700';
        Icon = AlertCircle;
      } else if (rawPercentage >= 80) {
        status = 'warning';
        colorClass = 'bg-orange-500';
        bgClass = 'bg-orange-50';
        textClass = 'text-orange-700';
        Icon = AlertTriangle;
      }

      return {
        ...cat,
        spent,
        visualPercentage,
        rawPercentage,
        status,
        colorClass,
        bgClass,
        textClass,
        Icon
      };
    }).sort((a, b) => b.rawPercentage - a.rawPercentage); // Show the most critical budgets at the top

    setBudgets(progressData);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading budget health...</div>;
  }

  if (budgets.length === 0) {
    return null; // Hide the entire section if no budgets are set up yet
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
      <h3 className="font-bold text-gray-900 text-lg mb-4 border-b pb-4">Budget Health</h3>
      
      <div className="space-y-5">
        {budgets.map((item) => (
          <div key={item.id}>
            <div className="flex justify-between items-end mb-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-800">{item.name}</span>
                {item.status !== 'good' && (
                  <item.Icon className={`w-4 h-4 ${item.textClass}`} />
                )}
              </div>
              <div className="text-right">
                <span className={`font-bold ${item.status === 'over' ? 'text-red-600' : 'text-gray-900'}`}>
                  ₹{item.spent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-gray-400 text-sm"> / ₹{item.monthly_budget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
            
            {/* The Progress Bar Container */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-2.5 rounded-full transition-all duration-500 ${item.colorClass}`} 
                style={{ width: `${item.visualPercentage}%` }}
              ></div>
            </div>
            
            {/* Warning Text */}
            {item.status === 'over' && (
              <p className="text-xs text-red-600 mt-1 font-medium">Over budget by ₹{(item.spent - item.monthly_budget).toLocaleString('en-IN', { maximumFractionDigits: 0 })}!</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}