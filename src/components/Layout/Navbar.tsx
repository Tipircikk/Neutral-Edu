import React from 'react';
import { Menu } from 'lucide-react';
import UserProfileDropdown from './UserProfileDropdown';

interface NavbarProps {
    toggleSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar }) => {
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 md:px-6">
            <button
                onClick={toggleSidebar}
                className="p-2 -ml-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Toggle Sidebar"
            >
                <Menu className="h-6 w-6" />
            </button>
            
            <div className="flex items-center gap-4">
                <UserProfileDropdown />
            </div>
        </header>
    );
};

export default Navbar;