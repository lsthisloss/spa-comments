import { Menu } from 'antd';
import { HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import '../styles/SideBar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed] = useState(false);

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined className="sidebar-icon" />,
      label: !collapsed && <span className={location.pathname === '/' ? 'active-menu-item' : ''}>Home</span>,
      onClick: () => navigate('/'),
    },
    {
      key: '/search',
      icon: <SearchOutlined className="sidebar-icon" />,
      label: !collapsed && <span className={location.pathname === '/search' ? 'active-menu-item' : ''}>Search</span>,
      onClick: () => navigate('/search'),
    },
  ];

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <Menu
        mode="inline"
        className="sidebar-menu"
        items={menuItems}
        selectedKeys={[location.pathname]}
      />
    </nav>
  );
}