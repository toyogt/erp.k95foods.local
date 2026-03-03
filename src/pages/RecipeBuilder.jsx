import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ShieldOff } from 'lucide-react';
import RecipeGroupList from '@/components/recipe/RecipeGroupList';
import RecipeEditor from '@/components/recipe/RecipeEditor';

export default function RecipeBuilder() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [specs, setSpecs] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [brandItems, setBrandItems] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setAuthLoading(false); });
    loadMasterData();
    loadGroups();
  }, []);

  async function loadMasterData() {
    const [sp, um, bi] = await Promise.all([
      base44.entities.IngredientMaster.list('ingredient_name', 500),
      base44.entities.UOMMaster.filter({ is_active: true }),
      base44.entities.IngredientItem.list('-created_date', 1000),
    ]);
    setSpecs(sp);
    setUoms(um.sort((a, b) => a.uom_code?.localeCompare(b.uom_code)));
    setBrandItems(bi);
  }

  async function loadGroups() {
    setGroupsLoading(true);
    const grps = await base44.entities.RecipeGroup.list('recipe_name', 200);
    setGroups(grps);
    setGroupsLoading(false);
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  if (user?.role !== 'admin' && user?.role !== 'production_manager') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <ShieldOff className="w-12 h-12" />
        <p className="font-semibold text-lg">Access Restricted</p>
        <p className="text-sm">Recipe Builder is available to admin and production manager roles only.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left pane */}
      <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden flex flex-col">
        <RecipeGroupList
          groups={groups}
          loading={groupsLoading}
          selectedId={selectedGroup?.recipe_group_id}
          onSelect={g => setSelectedGroup(g)}
          onCreated={() => { loadGroups(); }}
        />
      </div>

      {/* Right pane */}
      <div className="flex-1 overflow-y-auto">
        {selectedGroup ? (
          <RecipeEditor
            key={selectedGroup.recipe_group_id}
            group={selectedGroup}
            specs={specs}
            uoms={uoms}
            brandItems={brandItems}
            user={user}
            onGroupUpdated={() => {
              loadGroups();
              // Refresh selected group data
              base44.entities.RecipeGroup.filter({ recipe_group_id: selectedGroup.recipe_group_id })
                .then(grps => { if (grps[0]) setSelectedGroup(grps[0]); });
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <p className="text-lg font-semibold">Select a recipe to edit</p>
            <p className="text-sm">Or create a new one using the list on the left.</p>
          </div>
        )}
      </div>
    </div>
  );
}