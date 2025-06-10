import React from 'react';
import { Result, Button } from 'antd';
import { logger } from "../../utils/Logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/*
  Компонент ErrorBoundary для перехвата ошибок в React приложении.
  Показывает сообщение об ошибке и кнопку для перезагрузки страницы.
*/
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Error caught in ErrorBoundary:", { error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle="An unexpected error occurred. Please try again later."
          extra={
            <Button type="primary" onClick={this.handleReload}>
              Reload Page
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;