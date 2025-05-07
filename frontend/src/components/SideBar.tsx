import { Menu } from 'antd';
import { HomeOutlined, IdcardOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../styles/main.scss';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed] = useState(false);

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined className="sidebar-icon" />,
      label: '',
    },
    {
      key: '/whoami',
      icon: <IdcardOutlined className="sidebar-icon" />,
      label: '',
    },
  ];

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <Menu
        mode="inline"
        className="sidebar-menu"
        items={menuItems}
        selectedKeys={[location.pathname]}
        onClick={({ key }) => navigate(key)}
      />
    </nav>
  );
}