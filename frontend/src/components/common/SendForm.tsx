import React, { useCallback, useRef } from "react";
import { Form, Input, Avatar, Image } from "antd";
import { observer } from "mobx-react-lite";
import SendFormFooter from "./SendFormFooter";
import CaptchaModal from "../ui/modals/CaptchaModal";
import { getAvatarColor } from "../ui/particles/avatarColor";
import { sendFormStore } from "../../services/stores/SendFormStore";
import { useEffect } from 'react';
import userStore from '../../services/stores/UserStore';

interface SendFormProps {
  type: "post" | "comment";
  parentId?: string;
  postId?: string;
  placeholder?: string;
  onSuccess?: () => void;
}

const SendForm = observer(({ type, parentId, postId, placeholder, onSuccess }: SendFormProps) => {
  const maxLength = 600;
  const dragCounterRef = useRef(0);
  const isFormDisabled = sendFormStore.loading;

  useEffect(() => {
    if (userStore.user?.id && userStore.user?.userName) {
      sendFormStore.initializeUser(
        userStore.user.id, 
        userStore.user.userName,
        userStore.user.avatarUrl ?? undefined,
        userStore.user.avatarShape as 'circle' | 'square'
      );
    }
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      sendFormStore.setDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      sendFormStore.setDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sendFormStore.setDragActive(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    sendFormStore.handleDragDrop(file);
  }, []);

  const getDragOverlayText = () => {
    if (sendFormStore.dragActive) {
      return "Drop image (JPG, PNG, GIF) or text file (.txt) here";
    }
    return "";
  };

  return (
    <>
      {sendFormStore.dragActive && (
        <div className="drag-overlay">
          {getDragOverlayText()}
        </div>
      )}
      <Form 
        className={`item-form ${isFormDisabled ? 'form-disabled' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="form-header">
          {sendFormStore.avatarUrl ? (
            <Avatar
              className="item-avatar"
              src={sendFormStore.avatarUrl}
              shape={sendFormStore.avatarShape}
              style={{ cursor: 'default' }}
            />
          ) : (
            <Avatar
              className="item-avatar"
              style={{
                background: getAvatarColor(sendFormStore.userName.charAt(0)),
              }}
              shape={sendFormStore.avatarShape}
            >
              {sendFormStore.userName.charAt(0).toUpperCase()}
            </Avatar>
          )}
          <div style={{ flex: 1 }}>
            <Input.TextArea
              id="item-input"
              autoSize={{ minRows: 1, maxRows: 10 }}
              placeholder={
                placeholder ||
                (type === "post" ? "What's happening?" : "Post a reply...")
              }
              value={sendFormStore.text}
              onChange={(e) => {
                if (!isFormDisabled) {
                  sendFormStore.setText(e.target.value);
                }
              }}
              className={`input-area ${isFormDisabled ? 'input-disabled' : ''}`}
              maxLength={maxLength}
              disabled={false}
            />
          </div>
        </div>
        <SendFormFooter
          text={sendFormStore.text}
          maxLength={600}
          onPostClick={() => sendFormStore.setCaptchaVisible(true)}
          onInsertTag={(tag) => {
            const tagTemplate = `<${tag}></${tag}>`;
            const prev = sendFormStore.text;
            const available = 600 - prev.length;
            if (available <= 0) return;
            sendFormStore.setText(prev + tagTemplate.slice(0, available));
          }}
          onImageUpload={(file) => sendFormStore.handleImageUpload(file)}
          onFileUpload={(file) => sendFormStore.handleFileUpload(file)}
          disabled={isFormDisabled}
          loading={sendFormStore.loading}
        />
      {(sendFormStore.imagePreview || sendFormStore.selectedFile) && (
        <div style={{
          marginBottom: '8px',
          padding: '4px 8px',
          background: '#f0f8ff',
          border: '1px solid #d1ecf1',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#0c5460'
        }}>
          Attachments: 
          {sendFormStore.imagePreview && ' 📷 Image'}
          {sendFormStore.imagePreview && sendFormStore.selectedFile && ' + '}
          {sendFormStore.selectedFile && ' 📄 File'}
        </div>
      )}
      {sendFormStore.imagePreview && (
        <div
          className="image-preview"
          style={{
            marginTop: "0",
            textAlign: "start",
            marginBottom: "8px",
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '4px'
          }}>
            <span style={{ fontSize: '12px', color: '#666' }}>📷 Image:</span>
            <button
              onClick={() => {
                sendFormStore.setImagePreview(null);
                sendFormStore.setSelectedImageFile(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff4d4f',
                cursor: 'pointer',
                padding: '0',
                fontSize: '12px'
              }}
            >
              ✕ Remove
            </button>
          </div>
          <Image
            src={sendFormStore.imagePreview}
            alt="Preview"
            style={{
              maxWidth: "180px",
              maxHeight: "120px",
              borderRadius: "8px",
            }}
          />
        </div>
      )}

        {sendFormStore.selectedFile && (
          <div 
            className="file-preview" 
            style={{ 
              marginBottom: 12, 
              color: "#888",
              padding: "8px",
              background: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #d9d9d9"
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between'
            }}>
              <div>
                <span>📄 {sendFormStore.selectedFile.name}</span>
                <span style={{ marginLeft: 8, fontSize: "12px" }}>
                  ({Math.round(sendFormStore.selectedFile.size / 1024)}KB)
                </span>
              </div>
              <button
                onClick={() => {
                  sendFormStore.setSelectedFile(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff4d4f',
                  cursor: 'pointer',
                  padding: '0 4px',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </Form>
      
        {sendFormStore.errorMessage && (
          <div className="error-toast show">{sendFormStore.errorMessage}</div>
        )}
        {sendFormStore.successMessage && (
          <div className={`success-toast show`}>{sendFormStore.successMessage}</div>
        )}
        
        <CaptchaModal
          visible={sendFormStore.captchaVisible}
          onClose={() => sendFormStore.setCaptchaVisible(false)}
          onSubmit={() => sendFormStore.send(type, parentId ?? postId, parentId ? postId : undefined, onSuccess)}
          text={sendFormStore.text}
          userInfo={{
            id: sendFormStore.userId,
            userName: sendFormStore.userName,
            email: "",
            token: "",
          }}
        />
    </>
  );
});

export default SendForm;