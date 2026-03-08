import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Plus, Trash2, Tag, Edit2 } from 'lucide-react';

// Helper to convert legacy Tailwind color strings to Hex codes for the picker
const getDotColor = (colorStr) => {
  if (!colorStr) return '#6b7280'; // Default gray
  if (colorStr.startsWith('#')) return colorStr; // Already a hex code
  
  const legacyColors = {
    blue: '#3b82f6',
    red: '#ef4444',
    green: '#22c55e',
    purple: '#a855f7',
    orange: '#f97316',
    teal: '#14b8a6',
    pink: '#ec4899',
    amber: '#f59e0b',
  };
  return legacyColors[colorStr] || '#6b7280';
};

export default function CategoryManager({ isOpen, onClose, householdId, onCategoryUpdated }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State (Defaulting to a nice blue hex code)
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [error, setError] = useState(null);
  
  // Track which category is being edited
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  useEffect(() => {
    if (isOpen && householdId) {
      fetchCategories();
      resetForm();
    }
  }, [isOpen, householdId]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setCategories(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName('');
    setBudget('');
    setSelectedColor('#3b82f6');
    setEditingCategoryId(null);
    setError(null);
  };

  const handleEditClick = (category) => {
    setName(category.name);
    setBudget(category.monthly_budget || '');
    // Convert old color names to hex so the color picker can read it!
    setSelectedColor(getDotColor(category.color));
    setEditingCategoryId(category.id);
    setError(null);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || (budget === '' && budget !== 0)) return;
    
    setSaving(true);
    setError(null);

    try {
      if (editingCategoryId) {
        // --- UPDATE EXISTING CATEGORY ---
        const { error: updateError } = await supabase
          .from('categories')
          .update({
            name: name.trim(),
            monthly_budget: parseFloat(budget) || 0,
            color: selectedColor // Now saves the exact Hex Code
          })
          .eq('id', editingCategoryId);

        if (updateError) throw updateError;

      } else {
        // --- INSERT NEW CATEGORY ---
        const { error: insertError } = await supabase
          .from('categories')
          .insert([{ 
            household_id: householdId, 
            name: name.trim(), 
            monthly_budget: parseFloat(budget) || 0,
            color: selectedColor // Now saves the exact Hex Code
          }]);

        if (insertError) throw insertError;
      }

      resetForm();
      await fetchCategories();
      if (onCategoryUpdated) onCategoryUpdated();

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category? Associated expenses will be marked as 'Untracked'.")) return;
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (!error) {
      if (editingCategoryId === id) resetForm();
      fetchCategories();
      if (onCategoryUpdated) onCategoryUpdated();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Tag className="w-5 h-5 mr-2 text-blue-600" />
            Manage Categories
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

          {/* Add/Edit Category Form */}
          <form onSubmit={handleSaveCategory} className={`mb-8 p-4 rounded-xl border ${editingCategoryId ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs font-bold uppercase ${editingCategoryId ? 'text-blue-600' : 'text-gray-500'}`}>
                {editingCategoryId ? 'Edit Category' : 'New Category'}
              </span>
              {editingCategoryId && (
                <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Cancel Edit
                </button>
              )}
            </div>
            
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                placeholder="Name (e.g. Groceries)"
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="number"
                placeholder="Budget (₹)"
                required
                min="0"
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            
            {/* Color Picker Row */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-1">
              <div className="flex items-center space-x-3">
                <label className="text-sm font-semibold text-gray-700">Category Color</label>
                
                {/* Custom Styled Native Color Picker */}
                <div 
                  className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-300 cursor-pointer shadow-sm hover:scale-110 transition-transform"
                  title="Choose a color"
                >
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center text-sm font-semibold shadow-sm"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : editingCategoryId ? (
                  <span className="px-1">Update</span>
                ) : (
                  <><Plus className="w-4 h-4 mr-1" /> Add</>
                )}
              </button>
            </div>
          </form>

          {/* Categories List */}
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Active Categories</h3>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          ) : categories.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4 border-2 border-dashed border-gray-100 rounded-lg">No categories yet. Add one above!</p>
          ) : (
            <ul className="space-y-3">
              {categories.map((cat) => {
                const hexColor = getDotColor(cat.color);

                return (
                  <li key={cat.id} className={`flex justify-between items-center p-3 rounded-lg border shadow-sm transition-colors ${editingCategoryId === cat.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center space-x-3">
                      {/* Dynamic Color Dot */}
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: hexColor }}
                      ></div>
                      <div>
                        <p className={`font-semibold ${editingCategoryId === cat.id ? 'text-blue-900' : 'text-gray-800'}`}>{cat.name}</p>
                        <p className={`text-xs ${editingCategoryId === cat.id ? 'text-blue-600' : 'text-gray-500'}`}>Budget: ₹{cat.monthly_budget?.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEditClick(cat)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-2 rounded hover:bg-blue-50"
                        title="Edit Category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded hover:bg-red-50"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}