import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Users, MessageSquare, Send, Mail, TrendingUp, Zap,
  BarChart3, ArrowUpRight, FileText, Loader2, TestTube
} from 'lucide-react';
import http from '../../../../utils/src/http';
// import { waChatApi } from '../../../../modules/wa-chat/frontend/wa-chat.api';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Grid } from '../layout/Grid';
import { Heading } from '../ui/Heading';
import { cn } from '../../../../utils/src/frontend-utils';

interface ChannelData {
  name: string;
  messages: number;
  color: string;
  percentage: number;
}

export function GlobalDashboard() {
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    messagesSent: 0,
    smsDelivered: 0,
    emailOpens: 0,
    conversions: 0,
    automations: 0,
  });
  const [channels, setChannels] = useState([] as ChannelData[]);

  useEffect(() => {
    // Fetch real data from API
    const fetchDashboardData = async () => {
      try {
        const response = await http.get('/analytics/dashboard');
        const data = response.data;
        setStats(data.stats || stats);
        setChannels(data.channels || []);
      } catch (error: any) {
        console.error('Dashboard API error:', error);
        // Keep default stats on error but log the issue
        if (error.response?.status === 404) {
          console.error('Dashboard endpoint not found - check backend routes');
        } else if (error.response?.status === 401) {
          console.error('Authentication required for dashboard');
        } else {
          console.error('Failed to load dashboard data:', error.message);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const statCards = [
    { title: 'Total Leads', value: formatNumber(stats.totalLeads), icon: <Users size={18} />, color: 'blue' as const },
    { title: 'Messages Sent', value: formatNumber(stats.messagesSent), icon: <MessageSquare size={18} />, color: 'purple' as const },
    { title: 'SMS Delivered', value: formatNumber(stats.smsDelivered), icon: <Send size={18} />, color: 'emerald' as const },
    { title: 'Email Opens', value: formatNumber(stats.emailOpens), icon: <Mail size={18} />, color: 'amber' as const },
    { title: 'Conversions', value: formatNumber(stats.conversions), icon: <TrendingUp size={18} />, color: 'blue' as const },
    { title: 'Automations', value: formatNumber(stats.automations), icon: <Zap size={18} />, color: 'purple' as const },
  ];

  const defaultChannels: ChannelData[] = [
    { name: 'WhatsApp', messages: 0, color: 'bg-emerald-500', percentage: 0 },
    { name: 'SMS', messages: 0, color: 'bg-blue-500', percentage: 0 },
    { name: 'Email', messages: 0, color: 'bg-purple-500', percentage: 0 },
    { name: 'Telegram', messages: 0, color: 'bg-sky-500', percentage: 0 },
    { name: 'Messenger', messages: 0, color: 'bg-indigo-500', percentage: 0 },
    { name: 'Instagram', messages: 0, color: 'bg-pink-500', percentage: 0 },
  ];

  const displayChannels = channels.length > 0 ? channels : defaultChannels;

  // WhatsApp test function
  const handleWhatsAppTest = async () => {
    setTestLoading(true);
    try {
      console.log('🧪 Starting WhatsApp test...');
      
      // Send a test message via WhatsApp API
      const response = await http.post('/wa-chat/test', {
        phone: '+1234567890', // Test number
        message: `🧪 Test message from CRM Dashboard - ${new Date().toLocaleTimeString()}\n\n✨ Features available:\n• Real-time messaging\n• Media sharing\n• Status tracking\n• Contact management`
      });
      
      if (response.data.success) {
        console.log('✅ WhatsApp test message sent successfully:', response.data);
        alert(`✅ Success!\n\n${response.data.details || 'Test message sent successfully!'}\n\nConversation ID: ${response.data.conversation_id}`);
      } else {
        console.error('❌ WhatsApp test failed:', response.data);
        alert(`❌ Test Failed\n\n${response.data.error}\n\n${response.data.details || ''}`);
      }
    } catch (error: any) {
      console.error('❌ WhatsApp test error:', error);
      
      const errorData = error.response?.data;
      let errorMessage = '❌ WhatsApp Test Error\n\n';
      
      if (errorData?.error) {
        errorMessage += `Error: ${errorData.error}\n`;
        
        if (errorData.details) {
          errorMessage += `Details: ${errorData.details}\n`;
        }
        
        // Show setup instructions if credentials not configured
        if (errorData.setup_instructions) {
          errorMessage += '\n📋 Setup Instructions:\n';
          Object.entries(errorData.setup_instructions).forEach(([key, value]) => {
            errorMessage += `${key.replace('step', 'Step ')}: ${value}\n`;
          });
        }
      } else {
        errorMessage += `Error: ${error.message || 'Unknown error occurred'}`;
      }
      
      alert(errorMessage);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Heading as="h1" subtitle="Welcome back. Here's your business overview.">
        Dashboard
      </Heading>

      {/* Stats */}
      <Grid cols={3} gap="md">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </Grid>

      {/* Channel breakdown */}
      <Card animated padding="lg">
        <CardHeader>
          <CardTitle>Channel Activity</CardTitle>
          <a href="/analytics" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            View analytics <ArrowUpRight size={12} />
          </a>
        </CardHeader>
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            displayChannels.map((ch: ChannelData) => (
              <div key={ch.name} className="flex items-center gap-3">
                <span className={cn('w-2 h-2 rounded-full', ch.color)} />
                <span className="text-sm text-[var(--text-secondary)] w-24">{ch.name}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', ch.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${ch.percentage || 0}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-12 text-right">{formatNumber(ch.messages)}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Quick actions */}
      <Grid cols={4} gap="md">
        {[
          { label: 'New Campaign', icon: <FileText size={18} />, href: '/campaigns/new' },
          { label: 'WA Chat', icon: <MessageSquare size={18} />, href: '/wa-chat' },
          { label: 'Analytics', icon: <BarChart3 size={18} />, href: '/analytics' },
          { label: 'Leads', icon: <Users size={18} />, href: '/leads' },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="card card-interactive p-4 flex items-center gap-3 group"
          >
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400
                            border border-blue-500/20 group-hover:glow-blue transition-shadow">
              {action.icon}
            </span>
            <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {action.label}
            </span>
          </a>
        ))}
        
        {/* WhatsApp Test Button */}
        <button
          onClick={handleWhatsAppTest}
          disabled={testLoading}
          className="card card-interactive p-4 flex items-center gap-3 group disabled:opacity-50"
        >
          <span className="p-2 rounded-lg bg-green-500/10 text-green-400
                          border border-green-500/20 group-hover:glow-green transition-shadow">
            {testLoading ? <Loader2 size={18} className="animate-spin" /> : <TestTube size={18} />}
          </span>
          <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            {testLoading ? 'Testing...' : 'WA Test'}
          </span>
        </button>
      </Grid>
    </div>
  );
}

