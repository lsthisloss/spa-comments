import SendForm from '../common/SendForm';

/*
  CommentForm — компонент для отображения формы создания комментария
  - Использует SendForm для отправки данных на сервер
  - Принимает опциональный parentId для вложенных комментариев
  - Позволяет пользователю вводить текст комментария и отправлять его
*/

export default function CommentForm(props: { parentId?: string; placeholder?: string; onSuccess?: () => void }) {
  return <SendForm type="comment" {...props} />;
}