import { Form, Input, Avatar } from 'antd';
import { useState } from 'react';
import '../../styles/Comments/CommentForm.css';
import FormFooter from './FormFooter';

export default function CommentForm() {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    console.log('Comment submitted:', text);
    setText('');
  };

  return (
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
      <FormFooter />
    </Form>
  );
}