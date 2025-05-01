import { Form, Input, Button, Upload, Avatar } from 'antd';
import { useState } from 'react';
import { UploadOutlined, PictureOutlined, SmileOutlined } from '@ant-design/icons';
import '../styles/CommentForm.css';

export default function CommentForm() {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    console.log('Comment submitted:', text);
    setText('');
  };

  return (
    <Form onFinish={handleSubmit} className="comment-form">
      <div className="form-header">
        <Avatar
          className="comment-avatar">
          F
        </Avatar>
        <Input.TextArea
          rows={3}
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
  );
}