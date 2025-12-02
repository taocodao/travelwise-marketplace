'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, DollarSign, Bot } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/wallet', label: 'Wallet Setup', icon: Wallet },
    { href: '/admin/pricing', label: 'Pricing Config', icon: DollarSign },
    { href: '/admin/agents', label: 'Agent Management', icon: Bot },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-2 mb-6">
      <div className="flex space-x-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
