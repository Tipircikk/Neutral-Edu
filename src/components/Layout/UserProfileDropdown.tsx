import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const UserProfileDropdown: React.FC = () => {
    const { userData, logout } = useAuth();
    const { toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    if (!userData) {
        return null;
    }

    const handleLogout = async () => {
        try {
            await logout();
            setIsOpen(false);
        } catch (error) {
            console.error("Çıkış yaparken hata:", error);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-full p-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold">
                    {userData.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={16} className={`transition-transform duration-200 text-gray-600 dark:text-gray-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-50"
                    >
                        <div className="p-2">
                            <div className="px-2 py-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{userData.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userData.email}</p>
                            </div>
                            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <Link to="/dashboard/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                                <UserIcon size={16} />
                                <span>Profilim</span>
                            </Link>
                            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">
                                <LogOut size={16} />
                                <span>Çıkış Yap</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserProfileDropdown; 