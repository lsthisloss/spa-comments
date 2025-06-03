import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Progress } from 'antd';
import { observer } from "mobx-react";
import { useUserStore, useSocketStore } from '../hooks/useStore';
import { LoginFormValues, RegisterFormValues } from '../types/interfaces';
import { useNavigate } from 'react-router-dom';

const AuthPage = observer(() => {
  // Получаем сторы через хуки
  const userStore = useUserStore();
  const socketStore = useSocketStore();
  
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const navigate = useNavigate();

  const handleAuthSuccess = async () => {
    try {
      // Небольшая задержка для завершения инициализации сокетов
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Переходим на главную
      navigate('/');
      setShowRegister(false);
      setShowLogin(false);
    } catch (error) {
      console.error('Error during auth success handling:', error);
    }
  };

  const onLogin = async (values: LoginFormValues) => {
    if (!socketStore.users || !isSocketReady) {
      message.error('No connection to server. Please try again later.');
      return;
    }

    try {
      const result = await userStore.login(values.email, values.password);
      
      if (result.success && result.user) {
        message.success('Login successful!');
        await handleAuthSuccess();
      } else {
        message.error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error('Failed to login. Please try again.');
    }
  };

  const onRegister = async (values: RegisterFormValues) => {
    if (!socketStore.users || !isSocketReady) {
      message.error('No connection to server. Please try again later.');
      return;
    }

    try {
      const result = await userStore.register(values.email, values.userName, values.password);
      
      if (result.success && result.user) {
        message.success('Registration successful!');
        await handleAuthSuccess();
      } else {
        message.error(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      message.error('Failed to register. Please try again.');
    }
  };

  // Функция для оценки надежности пароля
  const evaluatePasswordStrength = (password: string) => {
    if (!password) return 0;
    
    let strength = 0;
    
    if (password.length >= 6) strength += 20;
    if (password.length >= 10) strength += 10;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[@$!%*?&#^(){}[\]<>,.;:+=\-_|\\/"'`~]/.test(password)) strength += 25;
    
    return Math.min(100, strength);
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 30) return '#ff4d4f';
    if (strength < 60) return '#faad14';
    if (strength < 80) return '#1890ff';
    return '#52c41a';
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 30) return 'Weak';
    if (strength < 60) return 'Fair';
    if (strength < 80) return 'Good';
    return 'Strong';
  };

  useEffect(() => {
    if (socketStore.users) {
      const onConnect = () => setIsSocketReady(true);
      const onDisconnect = () => setIsSocketReady(false);
      socketStore.users.on('connect', onConnect);
      socketStore.users.on('disconnect', onDisconnect);
      if (socketStore.users.connected) setIsSocketReady(true);
      return () => {
        socketStore.users?.off('connect', onConnect);
        socketStore.users?.off('disconnect', onDisconnect);
      };
    }
  }, [socketStore]);  

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-lock" role="img" aria-label="Lock icon">
          <div className="lock-shackle"></div>
          <div className="lock-body"></div>
          <div className="lock-key"></div>
        </div>
        <h1 style={{ color: '#fff', marginBottom: 32 }}>Who Are You?</h1>
        <Button
          className="scale-in"
          type="primary"
          block
          size="large"
          style={{ marginBottom: 16 }}
          onClick={() => setShowRegister(true)}
        >
          Create account
        </Button>
        <Button
          className="scale-in"
          block
          size="large"
          onClick={() => setShowLogin(true)}
        >
          Login
        </Button>
      </div>

      {/* Modal for Registration */}
      <Modal
        className="modal"
        open={showRegister}
        onCancel={() => setShowRegister(false)}
        footer={null}
        title="Registration"
        centered
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={onRegister}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input 
              placeholder="your@email.com"
              autoComplete="email"
            />
          </Form.Item>
          
          <Form.Item
            label="Username"
            name="userName"
            rules={[
              { required: true, message: 'Please input your username!' },
              { min: 3, message: 'Username must be at least 3 characters!' },
              { max: 20, message: 'Username must be less than 20 characters!' },
              { 
                pattern: /^[a-zA-Z0-9_-]+$/, 
                message: 'Username can only contain letters, numbers, _ and -' 
              }
            ]}
          >
            <Input 
              placeholder="Username"
              autoComplete="username"
            />
          </Form.Item>
          
          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: 'Please input your password!' },
              { min: 6, message: 'Password must be at least 6 characters!' }
            ]}
          >
            <Input.Password 
              placeholder="Password"
              autoComplete="new-password"
              onChange={(e) => setPasswordStrength(evaluatePasswordStrength(e.target.value))}
            />
          </Form.Item>
          
          {passwordStrength > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: 4,
                fontSize: '12px',
                color: '#666'
              }}>
                <span>Password Strength</span>
                <span style={{ color: getPasswordStrengthColor(passwordStrength) }}>
                  {getPasswordStrengthText(passwordStrength)}
                </span>
              </div>
              <Progress 
                percent={passwordStrength} 
                strokeColor={getPasswordStrengthColor(passwordStrength)}
                showInfo={false}
                size="small"
              />
            </div>
          )}
          
          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password 
              placeholder="Confirm Password"
              autoComplete="new-password"
            />
          </Form.Item>
          
          <Button
            className="scale-in"
            type="primary"
            htmlType="submit"
            block
            loading={userStore.loginLoading}
          >
            Register
          </Button>
        </Form>
      </Modal>

      {/* Modal for Login */}
      <Modal
        className="modal"
        open={showLogin}
        onCancel={() => setShowLogin(false)}
        footer={null}
        title="Login"
        centered
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={onLogin}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input 
              placeholder="your@email.com"
              autoComplete="email"
            />
          </Form.Item>
          
          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: 'Please input your password!' }
            ]}
          >
            <Input.Password 
              placeholder="Password"
              autoComplete="current-password"
            />
          </Form.Item>
          
          <Button
            className="scale-in"
            type="primary"
            htmlType="submit"
            block
            loading={userStore.loginLoading}
          >
            Login
          </Button>
        </Form>
      </Modal>
    </div>
  );
});

export default AuthPage;