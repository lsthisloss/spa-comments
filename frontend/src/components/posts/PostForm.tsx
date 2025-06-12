import SendForm from '../common/SendForm';

/*
  PostForm — компонент для отображения формы создания поста
  - Использует SendForm для отправки данных на сервер
  - Принимает функцию onSuccess для обработки успешной отправки
  - Позволяет пользователю вводить текст поста и отправлять его
*/

export default function PostForm(props: { onSuccess?: () => void }) {
  return <SendForm type="post" {...props} />;
}