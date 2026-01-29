import Link from "next/link";
import { Store, ShoppingCart, BarChart3, Settings, History } from "lucide-react";

export default function Home() {
  const modules = [
    { name: "POS Terminal", icon: ShoppingCart, href: "/pos", color: "bg-blue-600" },
    { name: "Inventory", icon: Store, href: "/inventory", color: "bg-orange-500" },
    { name: "Transactions", icon: History, href: "/transactions", color: "bg-emerald-600" },
    { name: "Reports", icon: BarChart3, href: "/reports", color: "bg-purple-600" },
    { name: "Settings", icon: Settings, href: "/settings", color: "bg-slate-600" },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-100">
      <h1 className="text-4xl font-bold mb-12 text-slate-800">Shop System</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
        {modules.map((mod) => (
          <Link 
            key={mod.name} 
            href={mod.href}
            className={`${mod.color} p-8 rounded-2xl shadow-lg hover:opacity-90 transition-all hover:-translate-y-1 text-white flex flex-col items-center justify-center gap-4`}
          >
            <mod.icon size={48} />
            <span className="text-2xl font-semibold">{mod.name}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
