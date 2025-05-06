import { Modal, Form, Input, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useState, useContext, useEffect } from 'react';
import { WebSocketContext } from '../WebSocketContext';
import { UserInfo } from '../../types/comment';

interface CaptchaModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { text: string; userInfo: UserInfo; captcha: string }) => void;
  text: string;
  userInfo: UserInfo;
}

export default function CaptchaModal({ visible, onClose, onSubmit, text, userInfo }: CaptchaModalProps) {
  const socket = useContext(WebSocketContext);
  const [captchaImage, setCaptchaImage] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [captchaError, setCaptchaError] = useState('');

  useEffect(() => {
    if (visible && socket) {
      setInputValue('');
      socket.emit('generateCaptcha', {}, (response: { image: string }) => {
        setCaptchaImage(response.image);
      });
    }
  }, [visible, socket]);

  const refreshCaptcha = () => {
    if (socket) {
      setInputValue('');
      socket.emit('generateCaptcha', {}, (response: { image: string }) => {
        setCaptchaImage(response.image);
      });
    }
  };

  const handleSubmit = () => {
    if (socket) {
      socket.emit('validateCaptcha', { captcha: inputValue }, (response: { valid: boolean }) => {
        if (response.valid) {
          onSubmit({ text, userInfo, captcha: inputValue });
          onClose();
        } else {
            if (response.valid) {
              setCaptchaError('');
              onSubmit({ text, userInfo, captcha: inputValue });
              onClose();
            } else {
              setCaptchaError('Captcha is incorrect. Please try again.');
              refreshCaptcha();
            }          refreshCaptcha();
          }
      });
    }
  };

  return (
    <Modal
      title="CAPTCHA Verification"
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
    >
      <Form layout="vertical" onFinish={handleSubmit}>
      <Form.Item>
        <div className="captcha-container" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={`data:image/svg+xml;base64,${btoa(captchaImage)}`} alt="CAPTCHA" />
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={refreshCaptcha}
            className="refresh-button"
          />
          <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
            Captcha is case-sensitive
          </span>
        </div>
        {captchaError && (
          <div style={{ color: '#d4380d', fontSize: 13, marginTop: 6 }}>
            {captchaError}
          </div>
        )}
      </Form.Item>
        <Form.Item>
          <Input
            maxLength={6}
            placeholder="Enter CAPTCHA"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Submit
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}