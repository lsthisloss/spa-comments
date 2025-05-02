import CommentItem from './CommentItem';
import { Comment } from '../../types/comment';

const dummyPosts: Comment[] = [
  { id: '1', userName: 'Anonymous', email: 'john@example.com', text: 'Veni, vidi, vici (с лат. — «Пришёл, увидел, победил») — крылатое латинское выражение, слова, которыми, как сообщает Плутарх в своих «Изречениях царей и полководцев», Гай Юлий Цезарь в августе 47 года до н. э. уведомил своего друга Гая Мация в Риме о победе, быстро одержанной им при Зеле над Фарнаком, сыном Митридата Понтийского.', createdAt: new Date(), parentId: null },
  { id: '2', userName: 'JaneDoe', email: 'jane@example.com', text: 'Sapienti sat — латинское крылатое выражение, означающее в переводе «умному достаточно» или «для понимающего достаточно» и соответствующее русскому аналогу «умный поймёт»[1].', createdAt: new Date(), parentId: null },
  { id: '3', userName: 'Alice', email: 'alice@example.com', text: 'Thats awesome!', createdAt: new Date(), parentId: null },
  { id: '4', userName: 'Katherine Bowie', email: 'alice@example.com', text: 'Most people who yap for a living have no idea what IT means in this context. You cannot even begin to tackle waste, fraud and abuse if you don’t have a system of record, if there’s zero transparency in that system. If there’s 20 different systems that can’t talk to each other. If x.com/scottjenningsk', createdAt: new Date(), parentId: null },
  { id: '5', userName: 'Математик', email: 'alice@example.com', text: 'Основа логарифма. Основным называют число a, которое должно быть больше нуля и не равно 1. Чтобы решить логарифм, нужно подумать, к какой степени нужно поднести основание, чтобы получить ответ. Например, в примере:log232=5. Основой будет двойка. К какой степени нужно поднести 2, чтобы получить 32? Правильно, к пятому.', createdAt: new Date(), parentId: null },
];

interface CommentListProps {
  postId?: string;
}

export default function CommentList({ postId }: CommentListProps) {
  const posts = postId
    ? dummyPosts.filter((post) => post.id === postId)
    : dummyPosts.reverse(); 

  return (
    <div className="posts-container">
      {posts.map((post) => (
        <CommentItem key={post.id} comment={post} level={0} />
      ))}
    </div>
  );
}