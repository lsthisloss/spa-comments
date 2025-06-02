import React from 'react';
import { Tooltip } from 'antd';
import { CrownOutlined, StarOutlined } from '@ant-design/icons';

interface AdminBadgeProps {
  role: 'user' | 'admin' | 'superadmin';
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ role, className = '' }) => {
  if (role === 'user') {
    return null;
  }

  const getBadgeConfig = () => {
    switch (role) {
      case 'superadmin':
        return {
          icon: <CrownOutlined />,
          color: '#ff6b35',
          title: 'Super Administrator',
          className: 'admin-badge admin-badge--super'
        };
      case 'admin':
        return {
          icon: <StarOutlined />,
          color: '#1890ff',
          title: 'Administrator',
          className: 'admin-badge admin-badge--admin'
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  return (
    <Tooltip title={config.title} placement="top">
      <span 
        className={`${config.className} ${className}`}
        style={{ color: config.color, marginLeft: '4px', fontSize: '0.9em' }}
      >
        {config.icon}
      </span>
    </Tooltip>
  );
};

export default AdminBadge;