import { Modal, Form, Input, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import '../../styles/main.scss';

interface CaptchaModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CaptchaModal({ visible, onClose }: CaptchaModalProps) {
  const [captcha, setCaptcha] = useState(generateCaptcha());

  function generateCaptcha() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
  };

  const handleSubmit = (values: Record<string, string>) => {
    console.log('CAPTCHA submitted:', values);
    onClose(); 
  };

  return (
    <Modal
      title="CAPTCHA Verification"
      visible={visible}
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
        <Form.Item
          name="captcha"
          rules={[
            { required: true, message: 'Please enter the CAPTCHA!' },
            { pattern: new RegExp(`^[a-zA-Z0-9]{6}$`), message: 'CAPTCHA must be 6 characters!' },
          ]}
        >
          <Input maxLength={6} placeholder="Enter CAPTCHA" />
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