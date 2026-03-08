import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { supabase } from '../supabaseClient';

// Fallback colors just in case a category has no color assigned
const FALLBACK_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

// Helper to convert legacy strings or use the exact Hex Code
const getChartColor = (colorStr, index) => {
  if (!colorStr) return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  if (colorStr.startsWith('#')) return colorStr; 
  
  const legacyColors = {
    blue: '#3b82f6', red: '#ef4444', green: '#22c55e',
    purple: '#a855f7', orange: '#f97316', teal: '#14b8a6',
    pink: '#ec4899', amber: '#f59e0b',
  };
  return legacyColors[colorStr] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

export default function ExpensePieChart({ householdId, refreshTrigger, selectedMonth = new Date() }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    
    const date = new Date(selectedMonth);
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // 1. ADDED 'color' to the categories fetch query
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('amount, description, categories(name, color)') 
      .eq('household_id', householdId)
      .gte('expense_date', firstDay)
      .lte('expense_date', lastDay);

    if (!error && expenses) {
      let runningTotal = 0;
      
      // 2. Map the data and keep track of the color
      const aggregated = expenses.reduce((acc, exp) => {
        if (exp.description?.startsWith('Settled Up:')) return acc; 

        const catName = exp.categories?.name || 'Untracked';
        const catColor = exp.categories?.color || null;
        const amount = parseFloat(exp.amount);
        
        runningTotal += amount;
        
        if (!acc[catName]) {
          acc[catName] = { value: 0, color: catColor };
        }
        acc[catName].value += amount;
        
        return acc;
      }, {});

      // 3. Format it for Recharts
      const chartData = Object.keys(aggregated).map(key => ({
        name: key,
        value: aggregated[key].value,
        color: aggregated[key].color
      })).sort((a, b) => b.value - a.value);

      setData(chartData);
      setTotal(runningTotal);
    }
    setLoading(false);
  }, [householdId, selectedMonth]);

  useEffect(() => {
    if (householdId) {
      fetchChartData();
    }
  }, [householdId, refreshTrigger, fetchChartData]);

  if (loading) {
    return <div className="h-[300px] flex items-center justify-center text-gray-400">Loading chart...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg m-4 bg-gray-50">
        No expenses this month to visualize.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 300, minHeight: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              // 4. Paint the slice using the exact category color!
              <Cell key={`cell-${index}`} fill={getChartColor(entry.color, index)} />
            ))}
          </Pie>

          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-400 text-xs font-medium"
          >
            Total Spent
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-900 text-lg font-bold"
          >
            ₹{total.toLocaleString('en-IN')}
          </text>

          <Tooltip 
            formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}