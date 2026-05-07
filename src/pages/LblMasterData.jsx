import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LblLineManager from '@/components/labelling/LblLineManager';
import LblPrinterManager from '@/components/labelling/LblPrinterManager';
import LblPrintTemplateManager from '@/pages/LblPrintTemplateManager';
import { Tag, Printer, FileCode2 } from 'lucide-react';

export default function LblMasterData() {
  const [tab, setTab] = useState('lines');

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Labelling Master Data</h1>
        <p className="text-sm text-slate-500">Configure labelling lines, printers, and Rynan print templates</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="lines" className="gap-2 h-11 md:h-9">
            <Tag className="w-4 h-4" /> Labelling Lines
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-2 h-11 md:h-9">
            <Printer className="w-4 h-4" /> Printers
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 h-11 md:h-9">
            <FileCode2 className="w-4 h-4" /> Rynan Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="mt-4">
          <LblLineManager />
        </TabsContent>
        <TabsContent value="printers" className="mt-4">
          <LblPrinterManager />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <LblPrintTemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}