import React from 'react';
import { Database, Server, Globe, Cpu } from 'lucide-react';

export default function Sidebar() {
  // This function packages the data when you start dragging an item
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 z-10 text-slate-200">
      <div className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-2">
        Components
      </div>
      
      {/* Draggable UI Component */}
      <div 
        className="flex items-center gap-3 p-3 bg-slate-800 rounded-md border border-slate-700 cursor-grab hover:bg-slate-700 hover:border-blue-500 transition-all shadow-sm"
        onDragStart={(e) => onDragStart(e, 'tech', '🌐 Client / UI')}
        draggable
      >
        <Globe size={18} className="text-blue-400" />
        <span className="text-sm font-medium">Client / UI</span>
      </div>
      
      {/* Draggable API Component */}
      <div 
        className="flex items-center gap-3 p-3 bg-slate-800 rounded-md border border-slate-700 cursor-grab hover:bg-slate-700 hover:border-green-500 transition-all shadow-sm"
        onDragStart={(e) => onDragStart(e, 'tech', '⚙️ API Gateway')}
        draggable
      >
        <Server size={18} className="text-green-400" />
        <span className="text-sm font-medium">API Gateway</span>
      </div>

      {/* Draggable Database Component */}
      <div 
        className="flex items-center gap-3 p-3 bg-slate-800 rounded-md border border-slate-700 cursor-grab hover:bg-slate-700 hover:border-orange-500 transition-all shadow-sm"
        onDragStart={(e) => onDragStart(e, 'tech', '🗄️ Database')}
        draggable
      >
        <Database size={18} className="text-orange-400" />
        <span className="text-sm font-medium">Database</span>
      </div>

      {/* Draggable Microservice Component */}
      <div 
        className="flex items-center gap-3 p-3 bg-slate-800 rounded-md border border-slate-700 cursor-grab hover:bg-slate-700 hover:border-purple-500 transition-all shadow-sm"
        onDragStart={(e) => onDragStart(e, 'tech', '⚡ Microservice')}
        draggable
      >
        <Cpu size={18} className="text-purple-400" />
        <span className="text-sm font-medium">Microservice</span>
      </div>
    </aside>
  );
}