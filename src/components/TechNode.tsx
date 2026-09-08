import React from 'react';
import { Handle, Position } from 'reactflow';

export default function TechNode({ data, selected }: { data: any, selected: boolean }) {
  return (
    <div 
      className={`px-4 py-3 shadow-lg rounded-lg bg-slate-800 border-2 transition-all duration-200 flex items-center min-w-[150px] justify-center
      ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'border-slate-600 hover:border-slate-500'}`}
    >
      {/* Top Connection Dot (Target) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-blue-400 border-2 border-slate-900"
      />
      
      {/* Node Content */}
      <div className="text-slate-100 font-medium text-sm tracking-wide">
        {data.label}
      </div>

      {/* Bottom Connection Dot (Source) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-blue-400 border-2 border-slate-900"
      />
    </div>
  );
}