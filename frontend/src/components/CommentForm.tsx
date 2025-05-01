import { Form, Input, Button, Upload, Avatar } from 'antd';
import { useState } from 'react';
import { UploadOutlined, PictureOutlined, SmileOutlined } from '@ant-design/icons';
import { ConfigProvider } from 'antd';
import { useGradientButtonStyle } from '../styles/GradientButtonStyles';
import '../styles/CommentForm.css';

export default function CommentForm() {
  const [text, setText] = useState('');
  const { styles } = useGradientButtonStyle();

  const handleSubmit = () => {
    console.log('Comment submitted:', text);
    setText('');
  };

  return (
    <ConfigProvider
      button={{
        className: styles.linearGradientButton,
      }}
    >
      <Form onFinish={handleSubmit} className="comment-form">
        <div className="form-header">
          <Avatar className="comment-avatar">F</Avatar>
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 10 }}
            placeholder="What's happening?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input-area"
          />
        </div>
        <div className="form-footer">
          <div className="icon-group">
            <Upload>
              <Button icon={<UploadOutlined />} className="icon-button" />
            </Upload>
            <Button icon={<PictureOutlined />} className="icon-button" />
            <Button icon={<SmileOutlined />} className="icon-button" />
          </div>
          <Button type="primary" htmlType="submit" className="submit-button">
            Post
          </Button>
        </div>
      </Form>
    </ConfigProvider>
  );
}