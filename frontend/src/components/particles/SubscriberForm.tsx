import { Form, Input, Button, Modal } from 'antd';
import '../../styles/main.scss';

interface SubscriberFormProps {
  visible: boolean; 
  onClose: () => void; 
}

export default function SubscriberForm({ visible, onClose }: SubscriberFormProps) {
  interface FormValues {
    username: string;
    email: string;
    homepage?: string;
    captcha: string;
    text: string;
  }

  const handleSubmit = (values: FormValues) => {
    console.log('Form submitted:', values);
    
  };

  return (
    <Modal
      title="Subscribe"
      visible={visible}
      onCancel={onClose}
      footer={null}
      centered
    >
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="User Name"
          name="username"
          rules={[
            { required: true, message: 'Please enter your username!' },
            { pattern: /^[a-zA-Z0-9]+$/, message: 'Only letters and numbers are allowed!' },
          ]}
        >
          <Input placeholder="Enter your username" />
        </Form.Item>

        <Form.Item
          label="E-mail"
          name="email"
          rules={[
            { required: true, message: 'Please enter your email!' },
            { type: 'email', message: 'Please enter a valid email!' },
          ]}
        >
          <Input placeholder="Enter your email" />
        </Form.Item>

        <Form.Item
          label="Home Page"
          name="homepage"
          rules={[
            { type: 'url', message: 'Please enter a valid URL!' },
          ]}
        >
          <Input placeholder="Enter your homepage (optional)" />
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