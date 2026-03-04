import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Handshake, ArrowRightCircle, CheckCircle2 } from 'lucide-react';

export default function SettlementsModal({ isOpen, onClose, householdId, onSettlementComplete }) {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);
  const [processingId, setProcessingId] = useState(null); // To show loading state on the button

  useEffect(() => {
    if (isOpen && householdId) {
      calculateSettlements();
    }
  }, [isOpen, householdId]);

  const calculateSettlements = async () => {
    setLoading(true);

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .eq('household_id', householdId);

    const { data: splitsData } = await supabase
      .from('expense_splits')
      .select(`
        amount_owed,
        user_id,
        expenses!inner (paid_by)
      `)
      .eq('expenses.household_id', householdId);

    if (usersData && splitsData) {
      const balances = {};
      // We are now storing the ID alongside the name
      usersData.forEach(user => {
        balances[user.id] = { id: user.id, name: user.name, net: 0 };
      });

      splitsData.forEach(split => {
        const payer = split.expenses.paid_by;
        const borrower = split.user_id;
        const amount = parseFloat(split.amount_owed);

        if (payer !== borrower && balances[payer] && balances[borrower]) {
          balances[payer].net += amount;
          balances[borrower].net -= amount;
        }
      });

      const debtors = [];
      const creditors = [];

      Object.values(balances).forEach(user => {
        if (user.net < -0.01) debtors.push({ ...user, net: Math.abs(user.net) });
        if (user.net > 0.01) creditors.push(user);
      });

      debtors.sort((a, b) => b.net - a.net);
      creditors.sort((a, b) => b.net - a.net);

      const finalSettlements = [];
      let d = 0;
      let c = 0;

      while (d < debtors.length && c < creditors.length) {
        const debtor = debtors[d];
        const creditor = creditors[c];
        const amountToSettle = Math.min(debtor.net, creditor.net);

        finalSettlements.push({
          id: `${debtor.id}-${creditor.id}`, // Unique key for rendering
          fromId: debtor.id,
          fromName: debtor.name,
          toId: creditor.id,
          toName: creditor.name,
          amount: amountToSettle
        });

        debtors[d].net -= amountToSettle;
        creditors[c].net -= amountToSettle;

        if (debtors[d].net < 0.01) d++;
        if (creditors[c].net < 0.01) c++;
      }

      setSettlements(finalSettlements);
    }
    setLoading(false);
  };

  // NEW: The function that automatically clears the debt
  const handleSettleUp = async (settlement) => {
    setProcessingId(settlement.id);

    try {
      // 1. Create the Settlement Expense (Debtor is paying)
      const { data: expenseRecord, error: expenseError } = await supabase
        .from('expenses')
        .insert([{
          household_id: householdId,
          paid_by: settlement.fromId, 
          amount: settlement.amount,
          description: `Settled Up: ${settlement.fromName} paid ${settlement.toName}`,
          expense_date: new Date().toISOString().split('T')[0],
          split_type: 'CUSTOM'
        }])
        .select()
        .single();

      if (expenseError) throw expenseError;

      // 2. Assign the debt to the Creditor (They are receiving the value)
      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert([{
          expense_id: expenseRecord.id,
          user_id: settlement.toId,
          amount_owed: settlement.amount
        }]);

      if (splitError) throw splitError;

      // 3. Recalculate the math instantly and tell the Dashboard to update!
      await calculateSettlements();
      if (onSettlementComplete) onSettlementComplete();

    } catch (error) {
      console.error("Error settling up:", error);
      alert("Something went wrong while settling up. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Handshake className="w-5 h-5 mr-2 text-blue-600" />
            Settle Up
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          <p className="text-sm text-gray-500 mb-6 text-center">
            Click "Mark as Paid" once the transfer is complete to clear the debt.
          </p>

          {loading ? (
            <p className="text-center text-gray-400 py-4">Calculating math...</p>
          ) : settlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-600">
              <CheckCircle2 className="w-12 h-12 mb-3 opacity-80" />
              <p className="text-lg font-bold">All settled up!</p>
              <p className="text-sm text-gray-500">Nobody owes anything right now.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {settlements.map((settlement) => (
                <li key={settlement.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="font-semibold text-gray-800 truncate max-w-[100px]">{settlement.fromName}</span>
                      <ArrowRightCircle className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-800 truncate max-w-[100px]">{settlement.toName}</span>
                    </div>
                    <div className="font-bold text-lg text-blue-600 ml-4 shrink-0">
                      ₹{settlement.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  {/* The new action button */}
                  <button
                    onClick={() => handleSettleUp(settlement)}
                    disabled={processingId === settlement.id}
                    className="w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg border border-green-200 transition-colors text-sm disabled:opacity-50"
                  >
                    {processingId === settlement.id ? 'Processing...' : 'Mark as Paid'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}