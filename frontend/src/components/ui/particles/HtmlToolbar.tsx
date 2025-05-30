import React from 'react';
import { Button } from 'antd';

/*
  HtmlToolbar — компонент для отображения панели инструментов HTML
  - Позволяет пользователю вставлять HTML-теги в текстовое поле
  - Использует Ant Design для стилизации кнопок
  - Принимает функцию onInsertTag для обработки вставки тегов
*/

interface HtmlToolbarProps {
  onInsertTag: (tag: string) => void;
}

const HtmlToolbar: React.FC<HtmlToolbarProps> = ({ onInsertTag }) => {
  const tags = [
    { label: '[i]', tag: 'i' },
    { label: '[strong]', tag: 'strong' },
    { label: '[code]', tag: 'code' },
    { label: '[a]', tag: 'a' },
  ];

  return (
    <div className="html-toolbar">
      {tags.map(({ label, tag }) => (
        <Button
          key={tag}
          type="text"
          onClick={() => onInsertTag(tag)}
          className="html-toolbar-button"
        >
          {label}
        </Button>
      ))}
    </div>
  );
};

export default HtmlToolbar;