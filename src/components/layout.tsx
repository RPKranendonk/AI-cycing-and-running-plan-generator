// ============================================================================
// LAYOUT COMPONENT
// Main app layout with sidebar navigation
// Based on: _DESIGN_REFERENCE/client/src/components/layout.tsx
// ============================================================================

import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
    LayoutDashboard,
    CalendarDays,
    Activity,
    Settings,
    Menu,
    X,
    Zap,
} from 'lucide-react'
import { useState } from 'react'

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation()
    const { athlete } = useStore()
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    const navItems = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/schedule', label: 'Schedule', icon: CalendarDays },
        { href: '/progress', label: 'Progress', icon: Activity },
        { href: '/settings', label: 'Settings', icon: Settings },
    ]

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground p-4">
            {/* Logo */}
            <div className="flex items-center gap-3 px-2 py-6 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                    <Zap className="w-5 h-5" />
                </div>
                <span className="font-semibold text-lg tracking-tight">Endurance AI</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                            )}
                        >
                            <item.icon
                                className={cn(
                                    'w-5 h-5',
                                    isActive ? 'text-primary' : 'text-muted-foreground'
                                )}
                            />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* User Profile */}
            <div className="mt-auto pt-6 border-t border-sidebar-border">
                {athlete.name && (
                    <div className="flex items-center gap-3 px-2 mb-6">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                            {athlete.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{athlete.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{athlete.sport}</p>
                        </div>
                    </div>
                )}

                {/* Readiness Widget */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Readiness</span>
                        <span className="text-xs font-bold text-primary">85%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full w-[85%] transition-all" />
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-background flex">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block w-64 border-r border-sidebar-border fixed inset-y-0 left-0 z-50">
                <SidebarContent />
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border z-50 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <Zap className="w-6 h-6 text-primary" />
                    <span className="font-semibold">Endurance AI</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                >
                    {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </Button>
            </div>

            {/* Mobile Slide-out Menu */}
            {isMobileOpen && (
                <>
                    <div
                        className="md:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setIsMobileOpen(false)}
                    />
                    <div className="md:hidden fixed inset-y-0 left-0 w-72 z-50 bg-sidebar shadow-xl">
                        <SidebarContent />
                    </div>
                </>
            )}

            {/* Main Content */}
            <main className="flex-1 md:ml-64 min-h-screen p-4 md:p-8 pt-20 md:pt-8">
                <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    )
}
