import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Plus, Trash2, Tag, Edit2 } from 'lucide-react';

// Predefined safe Tailwind colors for the user to choose from
const COLOR_OPTIONS = [
  { name: 'Blue', value: 'blue', bgClass: 'bg-blue-500' },
  { name: 'Red', value: 'red', bgClass: 'bg-red-500' },
  { name: 'Green', value: 'green', bgClass: 'bg-green-500' },
  { name: 'Purple', value: 'purple', bgClass: 'bg-purple-500' },
  { name: 'Orange', value: 'orange', bgClass: 'bg-orange-500' },
  { name: 'Teal', value: 'teal', bgClass: 'bg-teal-500' },
  { name: 'Pink', value: 'pink', bgClass: 'bg-pink-500' },
  { name: 'Amber', value: 'amber', bgClass: 'bg-amber-500' },
];

export default function CategoryManager({ isOpen, onClose, householdId, onCategoryUpdated }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [error, setError] = useState(null);
  
  // NEW: Track which category is being edited
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  useEffect(() => {
    if (isOpen && householdId) {
      fetchCategories();
      resetForm(); // Ensure form is clean when opened
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
    setSelectedColor('blue');
    setEditingCategoryId(null);
    setError(null);
  };

  // NEW: Populate form when Edit is clicked
  const handleEditClick = (category) => {
    setName(category.name);
    setBudget(category.monthly_budget || '');
    setSelectedColor(category.color || 'blue');
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
            color: selectedColor
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
            color: selectedColor 
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
      if (editingCategoryId === id) resetForm(); // Clear form if they delete the one they are editing
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
            
            <div className="flex space-x-2 mb-3">
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
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={`w-6 h-6 rounded-full transition-all ${c.bgClass} ${
                      selectedColor === c.value 
                        ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' 
                        : 'opacity-50 hover:opacity-100 hover:scale-110'
                    }`}
                    title={c.name}
                  />
                ))}
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
                const catColorClass = COLOR_OPTIONS.find(c => c.value === cat.color)?.bgClass || 'bg-gray-500';

                return (
                  <li key={cat.id} className={`flex justify-between items-center p-3 rounded-lg border shadow-sm transition-colors ${editingCategoryId === cat.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${catColorClass}`}></div>
                      <div>
                        <p className={`font-semibold ${editingCategoryId === cat.id ? 'text-blue-900' : 'text-gray-800'}`}>{cat.name}</p>
                        <p className={`text-xs ${editingCategoryId === cat.id ? 'text-blue-600' : 'text-gray-500'}`}>Budget: ₹{cat.monthly_budget?.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      {/* NEW: Edit Button */}
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