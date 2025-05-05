import { Form, Input, Checkbox, Button } from 'antd';
import { useEffect, useState } from 'react';
import '../styles/main.scss';

export default function WhoAmIPage() {
  const [form] = Form.useForm();
  const [savedName, setSavedName] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      form.setFieldsValue(JSON.parse(userInfo));
    } else {
      form.setFieldsValue({
        userName: 'Anonymous',
        email: 'anonymous@example.com',
        agreeToTerms: true,
      });
    }
  }, [form]);

  const handleSave = (values: { userName: string; email: string; homePage?: string; agreeToTerms: boolean }) => {
    localStorage.setItem('userInfo', JSON.stringify(values));
    console.log('User info saved:', values);

    setSavedName(values.userName);
    setIsSaved(true);
  };

  return (
    <section className="who-am-i-page">
      <div className="who-am-i-content">
        {!isSaved && (
          <div className="who-am-i-text">
            <h1>Who Am I</h1>
            <p>
              This is a simple form to collect your name and email. This is not necessary for using your real name and email ;)
            </p>
          </div>
        )}
        <div className="who-am-i-form-container">
          {isSaved ? (
            <div className="saved-message">
              <h2>Thank you, {savedName}!</h2>
              <p>Your information has been saved successfully.</p>
            </div>
          ) : (
            <Form form={form} onFinish={handleSave} layout="vertical">
              <Form.Item
                label="User Name"
                name="userName"
                rules={[{ required: true, message: 'Please enter your name' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Home Page"
                name="homePage"
                rules={[{ required: false, type: 'url', message: 'Please enter your home page url' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="agreeToTerms"
                valuePropName="checked"
                rules={[{ required: true, message: 'You must agree to the terms' }]}
              >
                <Checkbox>I agree to the terms and conditions</Checkbox>
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="save-button"
                size="large"
                block
              >
                Save
              </Button>
            </Form>
          )}
        </div>
      </div>
    </section>
  );
}