'use client';

import React, { useState, useEffect } from 'react';
import { Database, Server, Globe, Box, Layers, Trash2 } from 'lucide-react';

const ICON_OPTIONS = [
  { id: 'cloud', emoji: '☁️', label: 'Cloud' },
  { id: 'lock', emoji: '🔒', label: 'Security' },
  { id: 'cpu', emoji: '⚙️', label: 'Compute' },
  { id: 'queue', emoji: '📨', label: 'Message' },
  { id: 'wrench', emoji: '🔧', label: 'Tool' },
];

export default function Sidebar() {
  const [customName, setCustomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [savedNodes, setSavedNodes] = useState<{id: string, name: string, emoji: string}[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('arch-os-custom-nodes');
    if (stored) setSavedNodes(JSON.parse(stored));
  }, []);

  const saveCustomNode = () => {
    if (!customName.trim()) return;
    const newNode = { id: Date.now().toString(), name: customName.trim(), emoji: selectedIcon.emoji };
    const updated = [...savedNodes, newNode];
    setSavedNodes(updated);
    localStorage.setItem('arch-os-custom-nodes', JSON.stringify(updated));
    setCustomName('');
  };

  const deleteCustomNode = (id: string) => {
    const updated = savedNodes.filter(n => n.id !== id);
    setSavedNodes(updated);
    localStorage.setItem('arch-os-custom-nodes', JSON.stringify(updated));
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col h-full shrink-0 overflow-y-auto">
      <h2 className="text-slate-100 font-semibold mb-6 flex items-center gap-2">
        <Layers size={18} className="text-blue-400" />
        Infrastructure
      </h2>

      <div className="space-y-6">
        {/* Standard Compute & Data Blocks */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Standard</h3>
          <div className="space-y-2">
            <div
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors flex items-center gap-3 text-sm font-medium"
              onDragStart={(e) => onDragStart(e, 'tech', '💻 Next.js Client')}
              draggable
            >
              <Globe size={16} className="text-blue-400" /> Next.js Client
            </div>
            <div
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors flex items-center gap-3 text-sm font-medium"
              onDragStart={(e) => onDragStart(e, 'tech', '🐘 PostgreSQL')}
              draggable
            >
              <Database size={16} className="text-blue-500" /> PostgreSQL
            </div>
            <div
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors flex items-center gap-3 text-sm font-medium"
              onDragStart={(e) => onDragStart(e, 'tech', '🔴 Redis Cache')}
              draggable
            >
              <Box size={16} className="text-red-500" /> Redis Cache
            </div>
          </div>
        </div>

        {/* Saved Custom Nodes */}
        {savedNodes.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">My Nodes</h3>
            <div className="space-y-2">
              {savedNodes.map((node) => (
                <div key={node.id} className="flex gap-2">
                  <div
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors flex items-center gap-3 text-sm font-medium"
                    onDragStart={(e) => onDragStart(e, 'tech', `${node.emoji} ${node.name}`)}
                    draggable
                  >
                    <span>{node.emoji}</span> {node.name}
                  </div>
                  <button 
                    onClick={() => deleteCustomNode(node.id)}
                    className="p-3 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Node Builder */}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Create Node</h3>
          <div className="space-y-3">
            <input 
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Kafka, Stripe API"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
            
            <div className="flex gap-2 justify-between">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() => setSelectedIcon(icon)}
                  className={`p-2 rounded-md transition-colors ${
                    selectedIcon.id === icon.id 
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 border' 
                      : 'bg-slate-950 border-slate-800 border text-slate-400 hover:bg-slate-800'
                  }`}
                  title={icon.label}
                >
                  {icon.emoji}
                </button>
              ))}
            </div>

            <button
              onClick={saveCustomNode}
              disabled={!customName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Save to Library
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}