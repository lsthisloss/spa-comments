import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, message, Typography, Divider } from 'antd';
import { UserAddOutlined, UserDeleteOutlined } from '@ant-design/icons';
import userStore from '../../services/stores/UserStore';

const { Title, Text } = Typography;

const AdminPanel: React.FC = observer(() => {
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePromoteToAdmin = async () => {
    if (!targetUserId.trim()) {
      message.error('Please enter a user ID');
      return;
    }

    setLoading(true);
    try {
      await userStore.promoteToAdmin(targetUserId.trim());
      message.success(`User promoted to Admin successfully`);
      setTargetUserId('');
    } catch (error) {
      console.error('Failed to promote user:', error);
      message.error(error instanceof Error ? error.message : 'Failed to promote user');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoteFromAdmin = async () => {
    if (!targetUserId.trim()) {
      message.error('Please enter a user ID');
      return;
    }

    setLoading(true);
    try {
      await userStore.demoteFromAdmin(targetUserId.trim());
      message.success(`Admin demoted to User successfully`);
      setTargetUserId('');
    } catch (error) {
      console.error('Failed to demote admin:', error);
      message.error(error instanceof Error ? error.message : 'Failed to demote admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <Title level={4}>👑 SuperAdmin Panel</Title>
      <Text type="secondary">
        Manage administrator roles. Only SuperAdmins can promote or demote users.
      </Text>
      
      <Divider />
      
      <div className="admin-panel__section">
        <Title level={5}>Role Management</Title>
        
        <div className="admin-panel__form">
          <Input
            placeholder="Enter User ID or Username"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          
          <div className="admin-panel__buttons">
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={handlePromoteToAdmin}
              loading={loading}
              style={{ marginRight: 8 }}
            >
              Promote to Admin
            </Button>
            
            <Button
              danger
              icon={<UserDeleteOutlined />}
              onClick={handleDemoteFromAdmin}
              loading={loading}
            >
              Demote from Admin
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdminPanel;