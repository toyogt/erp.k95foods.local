import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import LblLineManager from '@/components/labelling/LblLineManager';
import LblPrinterManager from '@/components/labelling/LblPrinterManager';
import { Tag, Printer, Shield } from 'lucide-react';

const EDIT_ROLES = ['admin', 'production_manager', 'labelling_supervisor', 'lbl_supervisor'];

export default function LblMasterData() {
  const [tab, setTab] = useState('lines');
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    base44.auth.me().then(u => setUserRole(u?.role || 'user')).catch(() => {});
  }, []);

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Labelling Master Data</h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-500">Configure labelling lines and printer settings</p>
          {!EDIT_ROLES.includes(userRole) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <Shield className="w-3 h-3" /> View Only
            </span>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="lines" className="gap-2 h-11 md:h-9">
            <Tag className="w-4 h-4" /> Labelling Lines
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-2 h-11 md:h-9">
            <Printer className="w-4 h-4" /> Printers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="mt-4">
          <LblLineManager userRole={userRole} />
        </TabsContent>
        <TabsContent value="printers" className="mt-4">
          <LblPrinterManager userRole={userRole} />
        </TabsContent>
      </Tabs>
    </div>
  );
}