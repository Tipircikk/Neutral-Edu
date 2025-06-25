import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900">
                    <div className="container mx-auto px-6 py-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;