import { useState, useEffect } from "react";
import { Modal, Button, Input, Form, message, Popconfirm } from "antd";
import { observer } from "mobx-react";
import userStore from "../../../services/stores/UserStore";
import { User } from "../../../types/interfaces";

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User;
}

const EditProfileModal = observer(({ visible, onClose, user }: EditProfileModalProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const uniqueId = `${user.id}-${Date.now()}`; // Ensure unique ID for each render

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        userName: user.userName,
        email: user.email,
      });
    }
  }, [visible, user, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await userStore.updateUser(values);
      message.success("Profile updated successfully");
      onClose();
    } catch (error) {
      console.error("Failed to update profile:", error);
      message.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await userStore.deleteUser();
      message.success("Account deleted successfully");
      onClose();
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to delete account:", error);
      message.error(
        error instanceof Error ? error.message : "Failed to delete account"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      key={`edit-profile-${uniqueId}`}
      title="Edit Profile"
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        className="edit-profile-modal__form"
      >
        <Form.Item
          name="userName"
          label="Username"
          rules={[{ required: true, message: "Please enter your username" }]}
          className="edit-profile-modal__form-item"
        >
          <Input
            id={`userName-input-${uniqueId}`}
            className="edit-profile-modal__form-input"
            autoComplete="username"
            aria-label="Username"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Please enter your email" },
            { type: "email", message: "Please enter a valid email" },
          ]}
          className="edit-profile-modal__form-item"
        >
          <Input
            id={`email-input-${uniqueId}`}
            className="edit-profile-modal__form-input"
            autoComplete="email"
            aria-label="Email address"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="New Password (leave empty to keep current)"
          className="edit-profile-modal__form-item"
        >
          <Input.Password
            id={`password-input-${uniqueId}`}
            className="edit-profile-modal__form-input"
            autoComplete="new-password"
            aria-label="New password"
          />
        </Form.Item>

        <div className="edit-profile-modal__actions">
          <div className="edit-profile-modal__actions-buttons">
            <Button onClick={onClose} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              Save Changes
            </Button>
          </div>

          <Popconfirm
            title="Delete account"
            description="Are you sure you want to delete your account? This action cannot be undone."
            onConfirm={handleDelete}
            okText="Yes, delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              loading={loading}
              className="edit-profile-modal__delete-button"
            >
              Delete Account
            </Button>
          </Popconfirm>
        </div>
      </Form>
    </Modal>
  );
});

export default EditProfileModal;