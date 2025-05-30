import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { observer } from "mobx-react";
import  userStore  from '../services/stores/UserStore';
import { socketStore } from '../services/stores/SocketStore';
import authStore from '../services/stores/AuthStore';
import { LoginFormValues, LoginResponse, RegisterFormValues, RegisterResponse } from '../types/interfaces';
import { useNavigate } from 'react-router-dom';
import { logger } from "../utils/Logger";

/* 
  AuthPage — компонент для отображения страницы аутентификации
  - Содержит формы для регистрации и входа в систему
  - Использует MobX для управления состоянием пользователя
  - При успешной аутентификации перенаправляет на главную страницу
  - Отображает сообщения об ошибках и загрузке
*/

const AuthPage = observer(() => {
  const socket = socketStore.users;
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const navigate = useNavigate();

  const handleAuthSuccess = async (user: LoginResponse['user'] & { token: string }) => {
    userStore.setUser(user);
    authStore.setAuth(user.token, user.id, user.userName);
    await socketStore.initializeAuthenticatedSockets(user.token);
    navigate('/');
    setShowRegister(false);
    setShowLogin(false);
  };

  const onLogin = (values: LoginFormValues) => {
    if (!socket || !isSocketReady) {
      setLoading(false);
      message.error('No connection to server. Please try again later.');
      return;
    }
    setLoading(true);
    socket.emit('login', values, (res: LoginResponse) => {
      setLoading(false);
      logger.log("Login response:", res);
      if (res?.success && res.user && res.token) {
        message.success('Login successful!');
        handleAuthSuccess({ ...res.user, token: res.token });
      } else {
        message.error(res?.message || 'Error during login');
      }
    });
  };

  const onRegister = (values: RegisterFormValues) => {
    if (!socket || !isSocketReady) {
      setLoading(false);
      message.error('No connection to server. Please try again later.');
      return;
    }
    setLoading(true);
    socket.emit('register', values, (res: RegisterResponse) => {
      setLoading(false);
      logger.log("Register response:", res);
      if (!res || typeof res !== 'object') {
        message.error('Invalid server response');
        return;
      }
      const response = Array.isArray(res) ? res[0] : res;
      if (response.success && response.user && response.token) {
        message.success('Registration successful!');
        handleAuthSuccess({ ...response.user, token: response.token });
      } else {
        message.error(response.message || 'Error during registration');
      }
    });
  };

  useEffect(() => {
    if (socket) {
      const onConnect = () => setIsSocketReady(true);
      const onDisconnect = () => setIsSocketReady(false);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (socket.connected) setIsSocketReady(true);
      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      };
    }
  }, [socket]);

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

      <Modal
        className="modal"
        open={showRegister}
        onCancel={() => setShowRegister(false)}
        footer={null}
        title="Registration"
        centered
        destroyOnClose
      >
      <Form layout="vertical" onFinish={onRegister}>
          <Form.Item
            name="email"
            label="E-mail"
            rules={[
              { required: true, message: 'Enter email address' },
              { 
                type: 'email', 
                message: 'Enter a valid email address' 
              },
              {
                pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: 'Email can only contain letters, numbers and symbols: . _ % + -'
              }
            ]}
          >
            <Input 
              autoComplete="username" 
              aria-label="Email address"
              placeholder="example@domain.com"
            />
          </Form.Item>

          <Form.Item
            name="userName"
            label="Username"
            rules={[
              { required: true, message: 'Enter username' },
              { 
                min: 4, 
                message: 'Username must be at least 4 characters long' 
              },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
                message: 'Username must start with a letter and contain only letters and numbers'
              }
            ]}
          >
            <Input 
              autoComplete="username" 
              aria-label="Username"
              placeholder="john123"
              maxLength={20}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^a-zA-Z0-9]/g, '');
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Enter password' },
              { min: 6, message: 'Password must be at least 6 characters long, and at least one letter and one number' },
              {
                pattern: /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/,
                message: 'Password must contain at least one letter and one number'
              }
            ]}
          >
            <Input.Password 
              autoComplete="new-password" 
              aria-label="Password"
              placeholder="At least 6 characters with letters and numbers"
            />
          </Form.Item>

          <Button
            className="scale-in"
            type="primary"
            htmlType="submit"
            block
            loading={loading}
          >
            Register
          </Button>
        </Form>
      </Modal>

      <Modal
        className="modal"
        open={showLogin}
        onCancel={() => setShowLogin(false)}
        footer={null}
        title="Вход"
        centered
        destroyOnClose
      >
      <Form layout="vertical" onFinish={onLogin}>
        <Form.Item
          name="email"
          label="E-mail"
          rules={[
            { required: true, message: 'Enter email address' },
            { 
              type: 'email', 
              message: 'Enter a valid email address' 
            }
          ]}
        >
          <Input 
            autoComplete="username" 
            aria-label="Email address"
            placeholder="example@domain.com"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: 'Enter password' },
            { min: 6, message: 'Password must be at least 6 characters long' }
          ]}
        >
          <Input.Password 
            autoComplete="current-password" 
            aria-label="Password"
            placeholder="Your password"
          />
        </Form.Item>

        <Button
          className="scale-in"
          type="primary"
          htmlType="submit"
          block
          loading={loading}
        >
          Login
        </Button>
      </Form>
      </Modal>
    </div>
  );
});

export default AuthPage;