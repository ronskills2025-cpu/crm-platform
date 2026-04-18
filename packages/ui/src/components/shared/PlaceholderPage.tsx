import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4 animate-fade-in">
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <Construction size={32} className="text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md text-center">
        This module is under development. Check back soon for updates.
      </p>
    </div>
  );
}
