import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AIAssistantDrawer from '@/components/ai/AIAssistantDrawer';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_22%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_18%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_48%,#f1f5f9_100%)] font-inter">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        collapsed ? "ml-[68px]" : "ml-[240px]"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="p-6 lg:p-8 max-w-[1600px]"
        >
          <Outlet />
        </motion.div>
      </main>
      <AIAssistantDrawer />
    </div>
  );
}
