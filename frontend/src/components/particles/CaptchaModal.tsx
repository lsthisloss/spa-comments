import { Modal, Form, Input, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface UserInfo {
  userName?: string;
  email?: string;
}

interface CaptchaModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { text: string; userInfo: UserInfo; captcha: string }) => void;
  text: string;
  userInfo: UserInfo;
}

export default function CaptchaModal({ visible, onClose, onSubmit, text, userInfo }: CaptchaModalProps) {
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [inputValue, setInputValue] = useState('');

  function generateCaptcha() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setInputValue('');
  };

  const handleSubmit = () => {
    if (inputValue === captcha) {
      onSubmit({ text, userInfo, captcha: inputValue });
      onClose();
    } else {
      alert('Captcha is incorrect. Please try again.');
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
          <div className="captcha-container">
            <span className="captcha">{captcha}</span>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={refreshCaptcha}
              className="refresh-button"
            />
          </div>
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