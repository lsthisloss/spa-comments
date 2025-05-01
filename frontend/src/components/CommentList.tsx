import CommentItem from './CommentItem';
import { Comment as CommentType } from '../types/comment';
import { JSX } from 'react';

const dummyComments: CommentType[] = [
  {
    id: '1',
    userName: 'JohnDoe',
    email: 'john@example.com',
    text: 'Sapienti sat — латинское крылатое выражение, означающее в переводе «умному достаточно» или для понимающего достаточно и соответствующее русскому аналогу «умный поймёт Впервые встречается в комедии Плавта Перс (IV, 7, 729) ',
    createdAt: new Date(),
    parentId: null,
  },
  {
    id: '2',
    userName: 'JaneDoe',
    email: 'jane@example.com',
    text: 'А затем в комедии Теренция «Формион», где юноша Антифон говорит с изворотливым рабом Гетой о спасении своего друга Формиона, который попал в плен к врагам. Они требуют от него выкуп, и он говорит: «Sapienti sat» — «умному достаточно». Указывает на то, что что-то можно понять без объяснений, если у слушателя достаточно мудрости или здравого смысла. Часто расширяется до dictum sapienti sat est (« достаточно сказано для мудрого », обычно переводится как «мудрому достаточно слова»).',
    createdAt: new Date(),
    parentId: '1',
  },
  {
    id: '3',
    userName: 'Alice',
    email: 'alice@example.com',
    text: 'С ума сойти, как же это интересно! ', 
    createdAt: new Date(),
    parentId: '2',
  },
];

export default function CommentList() {
  const renderComments = (parentId: string | null, level: number = 0): JSX.Element[] => {
    return dummyComments
      .filter((comment) => comment.parentId === parentId)
      .map((comment) => (
        <CommentItem key={comment.id} comment={comment} level={level}>
          {renderComments(comment.id, level + 1)}
        </CommentItem>
      ));
  };

  return <div>{renderComments(null)}</div>;
}