import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, message, Typography, Divider, Card, List, Avatar, Tag } from 'antd';
import { UserAddOutlined, UserDeleteOutlined, SearchOutlined, CrownOutlined, UserOutlined } from '@ant-design/icons';
import { User } from '../../types/interfaces';
import { useUserStore } from '../../hooks/useStore';


const { Title, Text } = Typography;

const AdminPanel: React.FC = observer(() => {
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const userStore = useUserStore();

  const handlePromoteUser = async () => {
    if (!targetUserId.trim()) {
      message.error('Please enter a user ID or username');
      return;
    }

    try {
      setIsPromoting(true);
      console.log(`[AdminPanel] Promoting user: "${targetUserId}"`);
      
      await userStore.promoteToAdmin(targetUserId.trim());
      message.success(`User promoted to admin successfully!`);
      setTargetUserId('');
      
      // Обновляем список пользователей если он открыт
      if (showUsers) {
        handleSearchUsers();
      }
    } catch (error: unknown) {
      console.error('Failed to promote user:', error);
      
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: string }).message === 'string' &&
        (error as { message: string }).message.includes('User not found')
      ) {
        try {
          const lowerCaseId = targetUserId.trim().toLowerCase();
          console.log(`[AdminPanel] Retrying with lowercase: "${lowerCaseId}"`);
          
          await userStore.promoteToAdmin(lowerCaseId);
          message.success(`User promoted to admin successfully!`);
          setTargetUserId('');
          
          if (showUsers) {
            handleSearchUsers();
          }
        } catch (retryError: unknown) {
          const errorMsg =
            retryError && typeof retryError === 'object' && 'message' in retryError && typeof (retryError as { message: string }).message === 'string'
              ? (retryError as { message: string }).message
              : 'Failed to promote user';
          message.error(`Failed to promote user: ${errorMsg}`);
        }
      } else {
        type ErrorWithMessage = { message: string };
        const errorMsg = typeof error === 'object' && error !== null && 'message' in error && typeof (error as ErrorWithMessage).message === 'string'
          ? (error as ErrorWithMessage).message
          : 'Failed to promote user';
        message.error(`Failed to promote user: ${errorMsg}`);
      }
    } finally {
      setIsPromoting(false);
    }
  };

  const handleSearchUsers = async () => {
    setUsersLoading(true);
    try {
      const fetchedUsers = await userStore.getAllUsers();
      setUsers(fetchedUsers);
      setShowUsers(true);
      
      // Статистика по ролям
      const stats = fetchedUsers.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📊 User statistics:', stats);
      message.success(`Found ${fetchedUsers.length} users. Details shown below.`);
    } catch (error) {
      console.error('Failed to get users:', error);
      message.error('Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleDemoteFromAdmin = async () => {
    if (!targetUserId.trim()) {
      message.error('Please enter a user ID');
      return;
    }

    setLoading(true);
    try {
      try {
        await userStore.demoteFromAdmin(targetUserId.trim());
        message.success(`Admin demoted to User successfully`);
        setTargetUserId('');
        
        // Обновляем список пользователей если он открыт
        if (showUsers) {
          handleSearchUsers();
        }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as { message: string }).message === 'string' &&
          (error as { message: string }).message.includes('User not found')
        ) {
          const lowerCaseId = targetUserId.trim().toLowerCase();
          console.log(`[AdminPanel] Retrying demote with lowercase: "${lowerCaseId}"`);
          
          await userStore.demoteFromAdmin(lowerCaseId);
          message.success(`Admin demoted to User successfully`);
          setTargetUserId('');
          
          if (showUsers) {
            handleSearchUsers();
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to demote admin:', error);
      message.error(error instanceof Error ? error.message : 'Failed to demote admin');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'gold';
      case 'admin': return 'blue';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin': return <CrownOutlined />;
      case 'admin': return <UserAddOutlined />;
      default: return <UserOutlined />;
    }
  };

  // Группируем пользователей по ролям
  const usersByRole = users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = [];
    acc[user.role].push(user);
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <div className="admin-panel">
      <Title level={4}>👑 SuperAdmin Panel</Title>
      <Text type="secondary">
        Manage administrator roles. Only SuperAdmins can promote or demote users.
      </Text>
      
      <Divider />
      
      <div className="admin-panel__section">
        <Title level={5}>Role Management</Title>
        
        <div className="admin-section" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>🔍 User Database</Title>
            <Button 
              onClick={handleSearchUsers} 
              type="primary" 
              icon={<SearchOutlined />}
              loading={usersLoading}
              size="small"
            >
              {showUsers ? 'Refresh Users' : 'Load Users'}
            </Button>
            {showUsers && (
              <Button 
                onClick={() => setShowUsers(false)} 
                type="default" 
                size="small"
              >
                Hide
              </Button>
            )}
          </div>

          {showUsers && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>📊 Total Users: {users.length}</Text>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(usersByRole).map(([role, roleUsers]) => (
                    <Tag 
                      key={role} 
                      color={getRoleColor(role)}
                      icon={getRoleIcon(role)}
                    >
                      {role}: {roleUsers.length}
                    </Tag>
                  ))}
                </div>
              </div>
              
              <List
                size="small"
                pagination={{ 
                  pageSize: 10, 
                  size: 'small',
                  showSizeChanger: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`
                }}
                dataSource={users}
                renderItem={(user) => (
                  <List.Item
                    actions={[
                      <Tag color={getRoleColor(user.role)} icon={getRoleIcon(user.role)} key="role">
                        {user.role}
                      </Tag>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        user.avatarUrl ? (
                          <Avatar src={user.avatarUrl} size={32} />
                        ) : (
                          <Avatar size={32} style={{ backgroundColor: '#1890ff' }}>
                            {user.userName.charAt(0).toUpperCase()}
                          </Avatar>
                        )
                      }
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong>{user.userName}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            slug: "{user.slug}"
                          </Text>
                        </div>
                      }
                      description={
                        <div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {user.email}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            ID: {user.id}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </div>
        
        <div className="admin-panel__form">
          <Input
            placeholder="Enter User ID or Username (e.g. BraveFox613 or bravefox613)"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            style={{ marginBottom: 12 }}
            onPressEnter={handlePromoteUser}
          />
          
          <div className="admin-panel__buttons">
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={handlePromoteUser}
              loading={isPromoting}
              style={{ marginRight: 8 }}
              disabled={!targetUserId.trim()}
            >
              Promote to Admin
            </Button>
            
            <Button
              danger
              icon={<UserDeleteOutlined />}
              onClick={handleDemoteFromAdmin}
              loading={loading}
              disabled={!targetUserId.trim()}
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