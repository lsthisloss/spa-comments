import { Menu } from 'antd';
import { HomeOutlined, SearchOutlined, MailOutlined } from '@ant-design/icons';
import '../styles/SideBar.css';

export default function Sidebar() {
  const menuItems = [
    {
      key: '1',
      icon: <HomeOutlined className="sidebar-icon" />,
    },
    {
      key: '2',
      icon: <SearchOutlined className="sidebar-icon" />,
    },
    {
      key: '3',
      icon: <MailOutlined className="sidebar-icon" />,
    },
  ];

  return (
    <nav className="sidebar">
      <Menu mode="inline" className="sidebar-menu" items={menuItems} />
    </nav>
  );
}