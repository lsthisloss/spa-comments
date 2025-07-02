import { Tooltip } from 'antd';
import { CrownOutlined, StarOutlined } from '@ant-design/icons';
import { UserRole } from '../../../types/interfaces';

interface AdminBadgeProps {
  role: UserRole;
  className?: string;
}

/*
  Компонент для отображения бейджа администратора.
  Показывает иконку и текст в зависимости от роли пользователя.
  Используется для обозначения уровня доступа администратора.
*/
export const AdminBadge = ({ role, className = '' }: AdminBadgeProps) => {
  if (role === 'user') {
    return null;
  }


    const getBadgeConfig = (role: UserRole) => {
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
      case 'test':
        return { color: 'purple', text: 'TEST' };
      case 'user':
      default:
        return null;
    }
  };


  const config = getBadgeConfig(role);
  if (!config) return null;

  return (
    <Tooltip title={config.title} placement="top">
      <span 
        className={`${config.className} ${className}`}
      >
        {config.icon}
      </span>
    </Tooltip>
  );
};

export default AdminBadge;