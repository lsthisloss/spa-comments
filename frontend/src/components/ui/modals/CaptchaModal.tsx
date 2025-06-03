import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Form } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useSendFormStore, useSocketStore } from '../../../hooks/useStore';
import { UserRole } from '../../../types/interfaces';

interface CaptchaModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  userRole: UserRole;
  socketType?: 'posts' | 'comments';
}

const CaptchaModal: React.FC<CaptchaModalProps> = ({ 
  visible, 
  onClose, 
  onSubmit,
  userRole,
  socketType = 'comments'
}) => {
  const socketStore = useSocketStore();
  const sendFormStore = useSendFormStore();
  const socket = socketType === 'posts' ? socketStore.posts : socketStore.comments;
    const [captchaImage, setCaptchaImage] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [loading, setLoading] = useState(false);

const refreshCaptcha = React.useCallback(() => {
  if (socket) {
    socket.emit('generateCaptcha', {}, (response: { image: string }) => {
      setCaptchaImage(response.image);
    });
  }
}, [socket]);


  useEffect(() => {
    if (visible && socket) {
      setInputValue('');
      refreshCaptcha();
    }
  }, [visible, socket, refreshCaptcha]);


const handleSubmit = () => {
  if (!socket) return;

  setLoading(true);
  socket.emit('validateCaptcha', { captcha: inputValue }, (response: { valid: boolean }) => {
    setLoading(false);
    if (response.valid) {
      setCaptchaError('');
      // Устанавливаем флаг в сторе
      sendFormStore.setCaptchaVerified(true);
      onSubmit();
      onClose();
    } else {
      setCaptchaError('Incorrect captcha. Please try again.');
      refreshCaptcha();
      setInputValue('');
    }
  });
};

  return (
    <Modal
      title="Security Check"
      open={visible && userRole === 'user'} // Показываем только для обычных пользователей
      onCancel={onClose}
      footer={null}
      centered
    >
      <Form onFinish={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <p>Please enter the characters you see in the image:</p>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <div 
              style={{ 
                marginRight: 8, 
                padding: '6px', 
                border: '1px solid #d9d9d9', 
                borderRadius: '4px',
                background: '#f5f5f5' 
              }}
            >
              <img 
                src={`data:image/svg+xml;base64,${btoa(captchaImage)}`} 
                alt="CAPTCHA" 
                style={{ height: '40px' }}
              />
            </div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={refreshCaptcha}
              type="text"
            />
          </div>
          
          <Form.Item 
            validateStatus={captchaError ? 'error' : ''}
            help={captchaError}
          >
            <Input
              placeholder="Enter captcha"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              maxLength={10}
              autoFocus
            />
          </Form.Item>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Submit
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default CaptchaModal;