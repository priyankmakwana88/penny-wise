import { useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { Download, ChevronDown } from 'lucide-react';

export default function ExportExcel({ householdId, householdName, currentUserId, currentUserName }) {
  const [exporting, setExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleExport = async (scope) => {
    setExporting(true);
    setShowOptions(false);

    try {
      let excelData = [];
      let fileName = '';

      if (scope === 'HOUSEHOLD') {
        // 1. Fetch entire household expenses
        const { data: expenses, error } = await supabase
          .from('expenses')
          .select(`
            expense_date,
            description,
            amount,
            split_type,
            categories (name),
            users!expenses_paid_by_fkey (name)
          `)
          .eq('household_id', householdId)
          .order('expense_date', { ascending: false });

        if (error) throw error;
        if (!expenses || expenses.length === 0) throw new Error("No expenses found.");

        excelData = expenses.map(exp => ({
          'Date': new Date(exp.expense_date).toLocaleDateString(),
          'Description': exp.description,
          'Category': exp.categories?.name || 'Untracked',
          'Total Amount (₹)': parseFloat(exp.amount),
          'Paid By': exp.users?.name || 'Unknown',
          'Split Type': exp.split_type
        }));
        
        fileName = `Full_Household_Finances_${new Date().toISOString().split('T')[0]}.xlsx`;

      } else if (scope === 'USER') {
        // 2. Fetch ONLY the current user's specific split amounts
        const { data: splits, error } = await supabase
          .from('expense_splits')
          .select(`
            amount_owed,
            expenses!inner (
              expense_date,
              description,
              amount,
              split_type,
              categories (name),
              users!expenses_paid_by_fkey (name)
            )
          `)
          .eq('user_id', currentUserId)
          .eq('expenses.household_id', householdId);

        if (error) throw error;
        if (!splits || splits.length === 0) throw new Error("No expenses found for you.");

        // Sort the splits by the expense date (newest first)
        splits.sort((a, b) => new Date(b.expenses.expense_date) - new Date(a.expenses.expense_date));

        // Format data: Show both the total bill AND their specific share
        excelData = splits.map(split => {
          const exp = split.expenses;
          return {
            'Date': new Date(exp.expense_date).toLocaleDateString(),
            'Description': exp.description,
            'Category': exp.categories?.name || 'Untracked',
            'Total Bill (₹)': parseFloat(exp.amount),            // The full 1000
            'Your Share (₹)': parseFloat(split.amount_owed),     // The actual 200 they owe!
            'Paid By': exp.users?.name || 'Unknown',
            'Split Type': exp.split_type
          };
        });

        fileName = `${currentUserName}_Only_Finances_${new Date().toISOString().split('T')[0]}.xlsx`;
      }

      // Generate the Excel Sheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

      // Set standard column widths so it looks clean
      const colWidths = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, fileName);

    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative inline-block text-left z-10">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={exporting}
        className="flex items-center space-x-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors border border-gray-200 px-3 py-1.5 rounded-lg bg-white shadow-sm"
      >
        <Download className="w-4 h-4" />
        <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {showOptions && (
        <>
          {/* Invisible overlay to close the dropdown when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowOptions(false)}
          ></div>
          
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
            <div className="py-1">
              <button
                onClick={() => handleExport('HOUSEHOLD')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
              >
                Entire Household
              </button>
              <button
                onClick={() => handleExport('USER')}
                className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium border-t border-gray-50"
              >
                Only My Expenses
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}