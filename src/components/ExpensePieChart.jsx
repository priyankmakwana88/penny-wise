import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { supabase } from '../supabaseClient';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function ExpensePieChart({ householdId, refreshTrigger, selectedMonth = new Date() }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    
    // Use the passed selectedMonth instead of strictly today
    const date = new Date(selectedMonth);
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('amount, description, categories(name)')
      .eq('household_id', householdId)
      .gte('expense_date', firstDay)
      .lte('expense_date', lastDay);

    if (!error && expenses) {
      let runningTotal = 0;
      const aggregated = expenses.reduce((acc, exp) => {
        if (exp.description?.startsWith('Settled Up:')) return acc; 

        const catName = exp.categories?.name || 'Untracked';
        const amount = parseFloat(exp.amount);
        
        runningTotal += amount;
        acc[catName] = (acc[catName] || 0) + amount;
        return acc;
      }, {});

      const chartData = Object.keys(aggregated).map(key => ({
        name: key,
        value: aggregated[key]
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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