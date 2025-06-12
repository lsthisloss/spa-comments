import { observer } from 'mobx-react-lite';
import { Card, Switch, Divider, Typography, Space, Tooltip, message } from 'antd';
import { BugOutlined, EyeOutlined, AlertOutlined } from '@ant-design/icons';
import AdminPanel from '../admin/AdminPanel';
import { useUserStore } from '../../hooks/useStore';
const { Title, Text } = Typography;

/*
  Компонент UserSettings отображает настройки пользователя, включая режим отладки.
  Позволяет пользователю включать и отключать режим отладки для отображения информации о виртуальном списке.
  Также отображает панель администратора для супер-администраторов.
*/
const UserSettings = observer(() => {

  const userStore = useUserStore();
  const user = userStore.user;
  
  if (!user) return null;

  const debugMode = user.settings?.debugMode ?? false;

  
  const handleDebugModeChange = async (checked: boolean) => {
    try {
      await userStore.updateUserSettings({ debugMode: checked });
      message.success(`Debug mode ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      message.error('Failed to update debug mode setting');
      console.error('Debug mode update error:', error);
    }
  };

  return (
    <Card 
      size="small" 
      style={{ 
        marginBottom: '16px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      <Title level={5} style={{ margin: 0, marginBottom: '12px' }}>
        <AlertOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
        Developer Settings
      </Title>
      
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <Space align="start" size="small">
              <BugOutlined style={{ color: debugMode ? '#52c41a' : '#8c8c8c', fontSize: '16px' }} />
              <div>
                <Text strong style={{ color: debugMode ? '#52c41a' : undefined }}>
                  Debug Mode
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Show virtual list debugging information
                </Text>
              </div>
            </Space>
          </div>
          
          <Tooltip 
            title={debugMode ? "Disable debug overlay" : "Enable debug overlay"}
            placement="left"
          >
            <Switch
              checked={debugMode}
              onChange={handleDebugModeChange}
              size="small"
              style={{
                backgroundColor: debugMode ? '#52c41a' : undefined
              }}
            />
          </Tooltip>
        </div>
        {userStore.isSuperAdmin && (
          <div className="user-settings__admin-section">
            <AdminPanel />
          </div>
        )}
        {debugMode && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#f6ffed', 
              borderRadius: '6px',
              border: '1px solid #b7eb8f'
            }}>
              <Space align="start" size="small">
                <EyeOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                <Text style={{ fontSize: '12px', color: '#52c41a' }}>
                  Debug overlay is now active. You'll see performance metrics and virtual list information.
                </Text>
              </Space>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
});

export default UserSettings;